-- ============================================================
-- V30: Asociar cada caja registradora a un almacén (ISSUE-007)
-- Sin este vínculo, la venta no tiene forma de saber de qué
-- almacén debe descontar existencia sin adivinar.
-- ============================================================

ALTER TABLE caja ADD COLUMN id_almacen BIGINT;

ALTER TABLE caja
    ADD CONSTRAINT fk_caja_almacen FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen);

-- Mejor esfuerzo para cajas ya existentes: se asignan al primer almacén
-- disponible. Si no hay ningún almacén todavía, la columna queda NULL y debe
-- asignarse manualmente desde Administración > Cajas antes de poder vender.
UPDATE caja
SET id_almacen = (SELECT id_almacen FROM almacen ORDER BY id_almacen ASC LIMIT 1)
WHERE id_almacen IS NULL;
