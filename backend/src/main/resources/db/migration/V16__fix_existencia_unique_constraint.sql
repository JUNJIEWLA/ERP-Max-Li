-- ============================================================
-- V16: Permitir un producto en múltiples almacenes
-- Cambia el constraint UNIQUE(id_producto) por UNIQUE(id_producto, id_almacen)
-- para soportar inventario multi-ubicación.
-- ============================================================

-- Eliminar el constraint UNIQUE original sobre id_producto
ALTER TABLE existencia DROP CONSTRAINT existencia_id_producto_key;

-- Agregar constraint compuesto: un producto solo puede tener UNA existencia por almacén
ALTER TABLE existencia ADD CONSTRAINT uk_existencia_producto_almacen UNIQUE (id_producto, id_almacen);
