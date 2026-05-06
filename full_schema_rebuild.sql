-- ========================================================
-- RECONSTRUCCIÓN COMPLETA FASTPOS SaaS v3 (UUID + FIFO + RLS)
-- ========================================================

-- LIMPIEZA TOTAL (CUIDADO: Borra datos existentes)
DROP TABLE IF EXISTS public.invites CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.customer_payments CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.usuarios_empresa CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;

-- EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. EMPRESAS (Tenants)
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_seguridad text DEFAULT '6767',
  estado_suscripcion text DEFAULT 'activo',
  created_at timestamptz DEFAULT now()
);

-- 2. ROLES
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text
);

-- Insertar roles básicos
INSERT INTO public.roles (name, description) VALUES 
('ADMIN', 'Acceso total a la empresa'),
('VENDEDOR', 'Acceso a ventas e inventario');

-- 3. USUARIOS POR EMPRESA (Mapping Auth -> Tenant)
CREATE TABLE public.usuarios_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (id_empresa, id_usuario)
);

-- 4. PRODUCTOS (Con soporte de código de barras)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  barcode text, -- El código de barras escaneable
  name text NOT NULL,
  type text NOT NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  UNIQUE (id_empresa, barcode)
);

-- 5. CLIENTES
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rut text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 6. LOTES (Inventario FIFO)
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  initial_quantity integer NOT NULL,
  quantity integer NOT NULL,
  cost numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CHECK (quantity >= 0),
  CHECK (initial_quantity >= quantity)
);

-- 7. MOVIMIENTOS DE INVENTARIO (Kardex)
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  type text NOT NULL, -- 'sale', 'purchase', 'adjustment'
  quantity integer NOT NULL,
  cost numeric,
  reference text,
  created_at timestamptz DEFAULT now()
);

-- 8. VENTAS
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  sale_price numeric NOT NULL,
  total numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  status text DEFAULT 'completed',
  ticket_id text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 9. GASTOS
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 10. INVITACIONES
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ========================================================
-- FUNCIÓN RPC: PROCESAR VENTA BULK CON LÓGICA FIFO
-- ========================================================

CREATE OR REPLACE FUNCTION public.process_bulk_sales(
  p_items jsonb,          -- Array de objetos: {product_id, quantity, sale_price}
  p_ticket_id text,
  p_id_empresa uuid,
  p_user_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'cash'
) RETURNS void AS $$
DECLARE
  v_item jsonb;
  v_remaining_qty int;
  v_batch_record RECORD;
  v_take_qty int;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_remaining_qty := (v_item->>'quantity')::int;

    -- Registrar la venta general (para reportes)
    INSERT INTO public.sales (id_empresa, product_id, customer_id, quantity, sale_price, total, ticket_id, user_id, payment_method)
    VALUES (p_id_empresa, (v_item->>'product_id')::uuid, p_customer_id, v_remaining_qty, (v_item->>'sale_price')::numeric, (v_item->>'sale_price')::numeric * v_remaining_qty, p_ticket_id, p_user_id, p_payment_method);

    -- Lógica FIFO: Descontar de los lotes más antiguos
    FOR v_batch_record IN 
      SELECT id, quantity, cost 
      FROM public.batches 
      WHERE product_id = (v_item->>'product_id')::uuid 
        AND id_empresa = p_id_empresa 
        AND quantity > 0 
      ORDER BY created_at ASC
    LOOP
      IF v_remaining_qty <= 0 THEN EXIT; END IF;

      v_take_qty := LEAST(v_remaining_qty, v_batch_record.quantity);

      UPDATE public.batches 
      SET quantity = quantity - v_take_qty 
      WHERE id = v_batch_record.id;

      INSERT INTO public.inventory_movements (id_empresa, product_id, batch_id, type, quantity, cost, reference)
      VALUES (p_id_empresa, (v_item->>'product_id')::uuid, v_batch_record.id, 'sale', -v_take_qty, v_batch_record.cost, p_ticket_id);

      v_remaining_qty := v_remaining_qty - v_take_qty;
    END LOOP;

    -- Si queda cantidad restante, significa que vendimos sin stock suficiente (stock negativo virtual)
    IF v_remaining_qty > 0 THEN
       INSERT INTO public.inventory_movements (id_empresa, product_id, type, quantity, reference)
       VALUES (p_id_empresa, (v_item->>'product_id')::uuid, 'sale', -v_remaining_qty, p_ticket_id);
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ========================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver lo que pertenece a su id_empresa
CREATE POLICY tenant_isolation_policy ON public.products
  FOR ALL USING (id_empresa IN (SELECT id_empresa FROM public.usuarios_empresa WHERE id_usuario = auth.uid()));

CREATE POLICY tenant_isolation_policy ON public.batches
  FOR ALL USING (id_empresa IN (SELECT id_empresa FROM public.usuarios_empresa WHERE id_usuario = auth.uid()));

CREATE POLICY tenant_isolation_policy ON public.sales
  FOR ALL USING (id_empresa IN (SELECT id_empresa FROM public.usuarios_empresa WHERE id_usuario = auth.uid()));

CREATE POLICY tenant_isolation_policy ON public.expenses
  FOR ALL USING (id_empresa IN (SELECT id_empresa FROM public.usuarios_empresa WHERE id_usuario = auth.uid()));

-- Índices para velocidad
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_batches_product ON public.batches(product_id);
CREATE INDEX idx_sales_ticket ON public.sales(ticket_id);
