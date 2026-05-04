# FastPOS - Setup Guide para Vercel + Supabase

## 1. CONFIGURACIÓN DE SUPABASE

### A. Crear Proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Copia las credenciales:
   - **VITE_SUPABASE_URL**: Tu URL de proyecto
   - **VITE_SUPABASE_ANON_KEY**: Tu clave anónima (pública para cliente)

### B. Configurar Variables de Entorno
Copia el contenido de `.env.example` a `.env.local`:
```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
GEMINI_API_KEY=ai-xxxxx  # Opcional
```

### C. Crear Tablas en Supabase

Accede al SQL Editor en Supabase y ejecuta:

```sql
-- Usuarios (gestión automática de Supabase Auth)

-- Productos
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sale_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lotes (FIFO de stock)
CREATE TABLE batches (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quantity INTEGER NOT NULL,
  initial_quantity INTEGER NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clientes
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rut TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, rut)
);

-- Ventas
CREATE TABLE sales (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id BIGINT REFERENCES customers(id),
  quantity INTEGER NOT NULL,
  sale_price DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  ticket_id TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pagos de clientes
CREATE TABLE customer_payments (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gastos
CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar queries
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_batches_product_id ON batches(product_id);
CREATE INDEX idx_batches_user_id ON batches(user_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_ticket_id ON sales(ticket_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customer_payments_user_id ON customer_payments(user_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
```

### D. Implementar Row Level Security (RLS)

RLS asegura que cada usuario solo vea sus propios datos.

```sql
-- Habilitar RLS para todas las tablas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura (SELECT)
CREATE POLICY "Users can view their own products"
ON products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own batches"
ON batches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own customers"
ON customers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sales"
ON sales FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own customer payments"
ON customer_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own expenses"
ON expenses FOR SELECT
USING (auth.uid() = user_id);

-- Políticas de inserción (INSERT)
CREATE POLICY "Users can insert their own products"
ON products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batches"
ON batches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own customers"
ON customers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales"
ON sales FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own customer payments"
ON customer_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
ON expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Políticas de actualización (UPDATE)
CREATE POLICY "Users can update their own products"
ON products FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches"
ON batches FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers"
ON customers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales"
ON sales FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customer payments"
ON customer_payments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON expenses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### E. Crear Funciones RPC para Operaciones Complejas

```sql
-- Actualizar stock de producto (FIFO)
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id TEXT,
  p_new_stock INTEGER,
  p_cost DECIMAL
)
RETURNS void AS $$
DECLARE
  v_current_stock INTEGER;
  v_reduction INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_current_stock
  FROM batches
  WHERE product_id = p_product_id AND user_id = auth.uid();

  v_reduction := v_current_stock - p_new_stock;

  IF v_reduction > 0 THEN
    UPDATE batches
    SET quantity = quantity - v_reduction
    WHERE product_id = p_product_id
    AND user_id = auth.uid()
    ORDER BY created_at ASC
    LIMIT (SELECT COUNT(*) FROM batches WHERE product_id = p_product_id AND user_id = auth.uid());
  ELSIF v_reduction < 0 THEN
    INSERT INTO batches (product_id, user_id, quantity, initial_quantity, cost)
    VALUES (p_product_id, auth.uid(), ABS(v_reduction), ABS(v_reduction), p_cost);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procesar ventas en lote
CREATE OR REPLACE FUNCTION process_bulk_sales(
  p_items JSONB,
  p_method TEXT,
  p_customer_id BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_ticket_id TEXT;
  v_total_cost DECIMAL;
BEGIN
  v_ticket_id := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(encode(gen_random_bytes(3), 'hex'), 1, 6);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sales (
      product_id, user_id, customer_id, quantity, sale_price, total_cost, 
      ticket_id, payment_method, status
    ) VALUES (
      v_item->>'product_id',
      auth.uid(),
      p_customer_id,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'sale_price')::DECIMAL,
      (v_item->>'total_cost')::DECIMAL,
      v_ticket_id,
      p_method,
      'completed'
    );
  END LOOP;

  RETURN json_build_object('ticket_id', v_ticket_id, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anular venta
CREATE OR REPLACE FUNCTION void_sale(p_ticket_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE sales
  SET status = 'voided'
  WHERE ticket_id = p_ticket_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 2. CONFIGURACIÓN EN VERCEL

### A. Conectar Repositorio Git
1. Crea un repositorio en GitHub
2. En Vercel, importa el repositorio
3. Vercel detectará automáticamente que es Vite

### B. Agregar Variables de Entorno en Vercel
En Project Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (opcional)

### C. Deploy
Vercel construirá automáticamente con `npm run build`

## 3. ACTUALIZAR CÓDIGO PARA ACEPTAR USER_ID

El código necesita ser actualizado para guardar `user_id` en todas las inserciones. Ejemplo en `src/lib/api.ts`:

```typescript
async createProduct(product: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.from('products').insert({
    id: product.id,
    user_id: user!.id,  // Agregar esto
    name: product.name,
    type: product.type,
    sale_price: product.sale_price
  });
  if (error) throw error;
}
```

## 4. TESTING LOCAL

```bash
# Instalar dependencias limpias
npm install

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build

# Preview de build
npm run preview
```

## 5. CHECKLIST DE DEPLOYMENT

- [ ] Todas las tablas creadas en Supabase
- [ ] RLS habilitado y políticas configuradas
- [ ] Funciones RPC creadas
- [ ] Variables de entorno en Vercel
- [ ] Variables de entorno en `.env` local
- [ ] Código actualizado para incluir `user_id`
- [ ] Tests de login y operaciones CRUD
- [ ] Domain custom configurado (opcional)
- [ ] SSL automático en Vercel
- [ ] Backups de Supabase habilitados

## 6. PRÓXIMOS PASOS (Escalabilidad Comercial)

- [ ] Implementar planes/suscripciones
- [ ] Sistema de facturación
- [ ] Exportación de reportes (PDF/Excel)
- [ ] Integración con pasarela de pagos
- [ ] Multi-tienda para usuarios enterprise
- [ ] API pública para integraciones
- [ ] Mobile app (React Native)
- [ ] Analytics y dashboards mejorados
