-- ACTUALIZACIÓN DE FUNCIONES RPC PARA SAAS
-- Copia y pega esto en el SQL Editor de Supabase y dale a RUN.

-- 1. Función para procesar ventas (Soporta id_empresa)
CREATE OR REPLACE FUNCTION public.process_bulk_sales(
    p_items jsonb,
    p_method text,
    p_customer_id integer,
    p_id_empresa uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_ticket_id text;
    v_required_quantity integer;
    v_batch record;
    v_total_cost numeric;
BEGIN
    v_ticket_id := 'T-' || floor(extract(epoch from now())) || '-' || floor(random() * 1000);

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_required_quantity := (item->>'quantity')::integer;
        v_total_cost := 0;

        FOR v_batch IN 
            SELECT id, quantity, cost 
            FROM batches 
            WHERE product_id = (item->>'product_id') 
              AND id_empresa = p_id_empresa 
              AND quantity > 0
            ORDER BY created_at ASC
        LOOP
            IF v_required_quantity <= 0 THEN EXIT; END IF;

            IF v_batch.quantity >= v_required_quantity THEN
                v_total_cost := v_total_cost + (v_required_quantity * v_batch.cost);
                UPDATE batches SET quantity = quantity - v_required_quantity WHERE id = v_batch.id;
                v_required_quantity := 0;
            ELSE
                v_total_cost := v_total_cost + (v_batch.quantity * v_batch.cost);
                v_required_quantity := v_required_quantity - v_batch.quantity;
                UPDATE batches SET quantity = 0 WHERE id = v_batch.id;
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
        ) VALUES (
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

-- 2. Función para actualizar stock (Soporta id_empresa)
CREATE OR REPLACE FUNCTION public.update_product_stock(
    p_product_id text,
    p_new_stock integer,
    p_cost numeric,
    p_id_empresa uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stock integer;
BEGIN
    SELECT COALESCE(SUM(quantity), 0) INTO v_current_stock 
    FROM batches 
    WHERE product_id = p_product_id AND id_empresa = p_id_empresa;

    IF p_new_stock > v_current_stock THEN
        INSERT INTO batches (product_id, id_empresa, user_id, quantity, initial_quantity, cost)
        VALUES (p_product_id, p_id_empresa, auth.uid(), p_new_stock - v_current_stock, p_new_stock - v_current_stock, p_cost);
    ELSIF p_new_stock < v_current_stock THEN
        DECLARE
            v_to_remove integer := v_current_stock - p_new_stock;
            v_batch record;
        BEGIN
            FOR v_batch IN SELECT id, quantity FROM batches WHERE product_id = p_product_id AND id_empresa = p_id_empresa AND quantity > 0 ORDER BY created_at DESC
            LOOP
                IF v_to_remove <= 0 THEN EXIT; END IF;
                IF v_batch.quantity >= v_to_remove THEN
                    UPDATE batches SET quantity = quantity - v_to_remove WHERE id = v_batch.id;
                    v_to_remove := 0;
                ELSE
                    v_to_remove := v_to_remove - v_batch.quantity;
                    UPDATE batches SET quantity = 0 WHERE id = v_batch.id;
                END IF;
            END LOOP;
        END;
    END IF;
END;
$$;

-- 3. Función para anular venta (Soporta id_empresa)
CREATE OR REPLACE FUNCTION public.void_sale(
    p_ticket_id text,
    p_id_empresa uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale record;
BEGIN
    UPDATE sales SET status = 'voided' 
    WHERE ticket_id = p_ticket_id AND id_empresa = p_id_empresa;

    FOR v_sale IN SELECT product_id, quantity, (total_cost/quantity) as cost FROM sales WHERE ticket_id = p_ticket_id AND id_empresa = p_id_empresa
    LOOP
        INSERT INTO batches (product_id, id_empresa, user_id, quantity, initial_quantity, cost)
        VALUES (v_sale.product_id, p_id_empresa, auth.uid(), v_sale.quantity, v_sale.quantity, v_sale.cost);
    END LOOP;
END;
$$;
