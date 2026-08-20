-- ═══════════════════════════════════════════════════════════════════
--  V45: Monto realmente recepcionado de una orden de compra
--
--  Al forzar el cierre de una orden con faltantes, el gasto se registraba
--  por 'total' —lo pactado— aunque al almacén hubiera entrado menos. Eso
--  autoriza pagar mercancía que nunca llegó y rompe la validación de 3 vías.
--
--  Esta columna guarda lo que el proveedor debe facturar según lo recibido.
--  Se deja NULL en las órdenes que cerraron completas: ahí 'total' ya es el
--  monto correcto y sobrescribirlo borraría el rastro de lo que se pidió.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE orden_compra
    ADD COLUMN total_recepcionado NUMERIC(12, 2);

COMMENT ON COLUMN orden_compra.total_recepcionado IS
    'Monto de lo efectivamente recibido, fijado al forzar el cierre con faltantes. '
    'NULL cuando la orden se completó entera: en ese caso rige total.';
