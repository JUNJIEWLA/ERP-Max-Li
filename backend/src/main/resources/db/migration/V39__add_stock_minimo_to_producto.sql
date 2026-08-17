-- ═══════════════════════════════════════════════════════════════════
--  V39: Añadir campo stock_minimo a la tabla producto
--
--  Define el nivel mínimo de existencias requeridas por producto.
--  Al alcanzar o caer por debajo de este valor en cualquier almacén,
--  se notifica en el Buzón con "Pocas existencias en [Almacén]".
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN producto.stock_minimo
    IS 'Cantidad mínima de inventario requerida antes de generar alerta de pocas existencias en buzón.';
