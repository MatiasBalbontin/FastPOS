-- Este script renombrará las tablas y columnas existentes de "tenant" a "empresa".
-- Ejecútalo en el SQL Editor de tu panel de Supabase.

-- 1. Renombrar la tabla principal de tenants a empresas
ALTER TABLE IF EXISTS public.tenants RENAME TO empresas;
-- Renombrar posibles secuencias o constraints de tenants (Supabase normalmente hace esto si es SERIAL, pero para UUID no suele haber problema, ignoramos constraints por simplicidad o los renombramos si es estricto)

-- 2. Agregar la columna de suscripción
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS estado_suscripcion text DEFAULT 'pendiente_pago';
-- Asegurarnos que las empresas existentes (si ya tienes data) estén activas por defecto
UPDATE public.empresas SET estado_suscripcion = 'activo' WHERE estado_suscripcion = 'pendiente_pago';

-- 3. Renombrar tenant_users a usuarios_empresa
ALTER TABLE IF EXISTS public.tenant_users RENAME TO usuarios_empresa;
ALTER TABLE IF EXISTS public.usuarios_empresa RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.usuarios_empresa RENAME COLUMN user_id TO id_usuario;

-- 4. Renombrar tenant_id a id_empresa en todas las otras tablas del sistema
ALTER TABLE IF EXISTS public.products RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.batches RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.sales RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.expenses RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.customers RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.customer_payments RENAME COLUMN tenant_id TO id_empresa;
ALTER TABLE IF EXISTS public.invites RENAME COLUMN tenant_id TO id_empresa;

-- 5. Actualizar políticas de RLS si existieran (opcional, si usas políticas manuales o RPCs, 
-- puede que requieran ser re-creadas para usar id_empresa en lugar de tenant_id. 
-- Si no estabas usando RLS estricto y hacías las validaciones en JS (api.ts), no necesitas cambiar RLS aquí.
-- Pero SÍ necesitas editar las Funciones RPC (ej. process_bulk_sales) si reciben p_tenant_id.
-- (Abajo hay un recordatorio para los RPCs)

/*
IMPORTANTE: Si tienes Funciones RPC en Supabase (como process_bulk_sales, update_product_stock, void_sale),
debes editarlas manualmente en Supabase -> Database -> Functions para que:
1. Reciban `p_id_empresa` en lugar de `p_tenant_id`
2. Usen `id_empresa` en las consultas internas en vez de `tenant_id`
*/
