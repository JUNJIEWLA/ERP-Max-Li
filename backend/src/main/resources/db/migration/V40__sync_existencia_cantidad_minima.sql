-- ═══════════════════════════════════════════════════════════════════
--  V40: Sincronizar cantidad_minima en existencia con producto.stock_minimo
--
--  Garantiza que la columna Mínimo en Inventario y las existencias
--  de todos los almacenes reflejen el stock_minimo definido en Producto.
-- ═══════════════════════════════════════════════════════════════════

UPDATE existencia e
SET cantidad_minima = p.stock_minimo
FROM producto p
WHERE e.id_producto = p.id_producto;
