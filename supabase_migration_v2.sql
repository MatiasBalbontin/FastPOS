-- MIGRACIÓN V2: AJUSTES DE SEGURIDAD Y CASCADA
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar PIN de seguridad a empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS pin_seguridad TEXT DEFAULT '6767';

-- 2. Configurar borrado en cascada para lotes (batches)
-- Esto soluciona el error "violates foreign key constraint batches_product_fkey"
ALTER TABLE public.batches 
DROP CONSTRAINT IF EXISTS batches_product_id_fkey,
ADD CONSTRAINT batches_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id) 
    ON DELETE CASCADE;

-- 3. Configurar borrado en cascada para ventas (opcional, pero recomendado para limpieza total)
ALTER TABLE public.sales 
DROP CONSTRAINT IF EXISTS sales_product_id_fkey,
ADD CONSTRAINT sales_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id) 
    ON DELETE CASCADE;
