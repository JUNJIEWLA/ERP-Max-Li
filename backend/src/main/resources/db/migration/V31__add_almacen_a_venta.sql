-- ============================================================
-- V31: Registrar en la venta el almacén del que se descontó
-- existencia (ISSUE-007), para trazabilidad. Las ventas históricas
-- quedan con id_almacen NULL: no se reescribe su origen.
-- ============================================================

ALTER TABLE venta ADD COLUMN id_almacen BIGINT;

ALTER TABLE venta
    ADD CONSTRAINT fk_venta_almacen FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen);
