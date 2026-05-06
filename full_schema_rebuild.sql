-- RECONSTRUCCIÓN COMPLETA DE ESQUEMA FASTPOS SAAS
-- ADVERTENCIA: Este script limpia y reconstruye las tablas principales para asegurar la integridad de datos.
-- Ejecutar en el SQL Editor de Supabase.
--1. LIMPIEZA DE TABLAS (Opcional, pero recomendado para consistencia)
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.customer_payments CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.invites CASCADE;
DROP TABLE IF EXISTS public.usuarios_empresa CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
-- 2. TABLAS BASE
CREATE TABLE IF NOT EXISTS public.empresas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    pin_seguridad text DEFAULT '6767',
    estado_suscripcion text DEFAULT 'activo',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT empresas_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);
-- Insertar roles base si no existen
INSERT INTO public.roles (name, description)
VALUES ('ADMIN', 'Acceso total a la empresa'),
    ('VENDEDOR', 'Acceso a ventas e inventario') ON CONFLICT (name) DO NOTHING;
-- 3. GESTIÓN DE USUARIOS
CREATE TABLE IF NOT EXISTS public.usuarios_empresa (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    id_empresa uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
    id_usuario uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES public.roles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_empresa_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_per_empresa UNIQUE (id_empresa, id_usuario)
);
CREATE TABLE IF NOT EXISTS public.invites (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    id_empresa uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
    email text NOT NULL,
    role_id uuid REFERENCES public.roles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT invites_pkey PRIMARY KEY (id)
);
-- 4. INVENTARIO Y PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
    id text NOT NULL,
    -- Barcode o ID manual
    id_empresa uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL,
    sale_price numeric NOT NULL DEFAULT 0,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT products_pkey PRIMARY KEY (id, id_empresa)
);
CREATE TABLE IF NOT EXISTS public.batches (
    id SERIAL PRIMARY KEY,
    id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    initial_quantity integer NOT NULL,
    cost numeric NOT NULL DEFAULT 0,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    -- FK Compuesta para asegurar que el producto pertenece a la misma empresa
    CONSTRAINT batches_product_fkey FOREIGN KEY (product_id, id_empresa) REFERENCES public.products(id, id_empresa) ON DELETE CASCADE
);
-- 5. VENTAS Y CLIENTES
CREATE TABLE IF NOT EXISTS public.customers (
    id SERIAL PRIMARY KEY,
    id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    rut text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sales (
    id SERIAL PRIMARY KEY,
    id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    customer_id integer REFERENCES public.customers(id) ON DELETE
    SET NULL,
        quantity integer NOT NULL,
        sale_price numeric NOT NULL,
        total_cost numeric NOT NULL,
        -- Costo total calculado por FIFO
        ticket_id text,
        payment_method text DEFAULT 'cash',
        status text DEFAULT 'completed',
        user_id uuid REFERENCES auth.users(id),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        -- FK Compuesta
        CONSTRAINT sales_product_fkey FOREIGN KEY (product_id, id_empresa) REFERENCES public.products(id, id_empresa) ON DELETE CASCADE
);
-- 6. FINANZAS
CREATE TABLE IF NOT EXISTS public.expenses (
    id SERIAL PRIMARY KEY,
    id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric NOT NULL,
    method text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id SERIAL PRIMARY KEY,
    id_empresa uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    customer_id integer NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    method text NOT NULL,
    status text DEFAULT 'completed',
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
-- 7. FUNCIONES RPC (Lógica de Negocio FIFO)
-- Eliminar funciones previas para evitar conflictos de firma
DROP FUNCTION IF EXISTS public.process_bulk_sales(jsonb, text, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.update_product_stock(text, integer, numeric, uuid);
-- Función de Ventas Masivas
CREATE OR REPLACE FUNCTION public.process_bulk_sales(
        p_items jsonb,
        p_method text,
        p_customer_id integer,
        p_id_empresa uuid,
        p_user_id uuid
    ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE item jsonb;
v_ticket_id text;
v_required_quantity integer;
v_batch record;
v_total_cost numeric;
BEGIN v_ticket_id := 'T-' || floor(
    extract(
        epoch
        from now()
    )
) || '-' || floor(random() * 1000);
FOR item IN
SELECT *
FROM jsonb_array_elements(p_items) LOOP v_required_quantity := (item->>'quantity')::integer;
v_total_cost := 0;
-- Lógica FIFO para reducir stock de lotes
FOR v_batch IN
SELECT id,
    quantity,
    cost
FROM batches
WHERE product_id = (item->>'product_id')
    AND id_empresa = p_id_empresa
    AND quantity > 0
ORDER BY created_at ASC LOOP IF v_required_quantity <= 0 THEN EXIT;
END IF;
IF v_batch.quantity >= v_required_quantity THEN v_total_cost := v_total_cost + (v_required_quantity * v_batch.cost);
UPDATE batches
SET quantity = quantity - v_required_quantity
WHERE id = v_batch.id;
v_required_quantity := 0;
ELSE v_total_cost := v_total_cost + (v_batch.quantity * v_batch.cost);
v_required_quantity := v_required_quantity - v_batch.quantity;
UPDATE batches
SET quantity = 0
WHERE id = v_batch.id;
END IF;
END LOOP;
INSERT INTO sales (
        id_empresa,
        user_id,
        product_id,
        quantity,
        sale_price,
        total_cost,
        payment_method,
        ticket_id,
        customer_id,
        status
    )
VALUES (
        p_id_empresa,
        p_user_id,
        (item->>'product_id'),
        (item->>'quantity')::integer,
        (item->>'sale_price')::numeric,
        v_total_cost,
        p_method,
        v_ticket_id,
        p_customer_id,
        'completed'
    );
END LOOP;
END;
$$;
-- Función de Actualización de Stock
CREATE OR REPLACE FUNCTION public.update_product_stock(
        p_product_id text,
        p_new_stock integer,
        p_cost numeric,
        p_id_empresa uuid
    ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_current_stock integer;
BEGIN
SELECT COALESCE(SUM(quantity), 0) INTO v_current_stock
FROM batches
WHERE product_id = p_product_id
    AND id_empresa = p_id_empresa;
IF p_new_stock > v_current_stock THEN
INSERT INTO batches (
        product_id,
        id_empresa,
        user_id,
        quantity,
        initial_quantity,
        cost
    )
VALUES (
        p_product_id,
        p_id_empresa,
        auth.uid(),
        p_new_stock - v_current_stock,
        p_new_stock - v_current_stock,
        p_cost
    );
ELSIF p_new_stock < v_current_stock THEN
DECLARE v_to_remove integer := v_current_stock - p_new_stock;
v_batch record;
BEGIN FOR v_batch IN
SELECT id,
    quantity
FROM batches
WHERE product_id = p_product_id
    AND id_empresa = p_id_empresa
    AND quantity > 0
ORDER BY created_at DESC -- Eliminar de los más nuevos primero
    LOOP IF v_to_remove <= 0 THEN EXIT;
END IF;
IF v_batch.quantity >= v_to_remove THEN
UPDATE batches
SET quantity = quantity - v_to_remove
WHERE id = v_batch.id;
v_to_remove := 0;
ELSE v_to_remove := v_to_remove - v_batch.quantity;
UPDATE batches
SET quantity = 0
WHERE id = v_batch.id;
END IF;
END LOOP;
END;
END IF;
END;
$$;
-- 8. SEGURIDAD RLS (Ejemplo para tabla products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver productos de su empresa" ON public.products FOR
SELECT USING (
        id_empresa IN (
            SELECT id_empresa
            FROM usuarios_empresa
            WHERE id_usuario = auth.uid()
        )
    );
-- Repetir políticas similares para el resto de tablas...