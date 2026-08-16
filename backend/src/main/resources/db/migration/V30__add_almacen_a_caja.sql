-- ============================================================
-- V30: Asociar cada caja registradora a un almacén (ISSUE-007)
-- Sin este vínculo, la venta no tiene forma de saber de qué
-- almacén debe descontar existencia sin adivinar.
-- ============================================================

ALTER TABLE caja ADD COLUMN id_almacen BIGINT;

ALTER TABLE caja
    ADD CONSTRAINT fk_caja_almacen FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen);

-- Mejor esfuerzo para cajas ya existentes: solo se autoasignan cuando hay
-- una única almacén ACTIVO sin ambigüedad posible. Si hay varios almacenes
-- activos (no hay forma de adivinar cuál corresponde a cada caja) o ninguno,
-- la columna queda NULL y debe asignarse manualmente desde
-- Administración > Cajas antes de poder vender.
UPDATE caja
SET id_almacen = (SELECT id_almacen FROM almacen WHERE estado = 'ACTIVO')
WHERE id_almacen IS NULL
  AND (SELECT COUNT(*) FROM almacen WHERE estado = 'ACTIVO') = 1;
