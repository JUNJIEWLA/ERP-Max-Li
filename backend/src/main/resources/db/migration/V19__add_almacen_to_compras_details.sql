-- ============================================================
-- V19: Agregar almacén a detalle de Orden de Compra y Nota de Recepción
-- ============================================================

-- Asegurar que exista al menos un almacén activo en el sistema
INSERT INTO almacen (nombre, descripcion, estado, fecha_creacion, fecha_modificacion)
SELECT 'Almacén Principal', 'Almacén por defecto creado para migración histórica', 'ACTIVO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM almacen WHERE estado = 'ACTIVO');

-- Agregar columna id_almacen a detalle_orden_compra
ALTER TABLE detalle_orden_compra ADD COLUMN id_almacen BIGINT;
ALTER TABLE detalle_orden_compra ADD CONSTRAINT fk_doc_almacen FOREIGN KEY (id_almacen) REFERENCES almacen (id_almacen);

-- Agregar columna id_almacen a detalle_nota_recepcion
ALTER TABLE detalle_nota_recepcion ADD COLUMN id_almacen BIGINT;
ALTER TABLE detalle_nota_recepcion ADD CONSTRAINT fk_dnr_almacen FOREIGN KEY (id_almacen) REFERENCES almacen (id_almacen);

-- Migrar registros históricos
-- 1. Heredar del detalle de orden de compra si está definido
UPDATE detalle_nota_recepcion dnr
SET id_almacen = doc.id_almacen
FROM detalle_orden_compra doc
WHERE dnr.id_detalle_orden_compra = doc.id_detalle_orden_compra
  AND dnr.id_almacen IS NULL
  AND doc.id_almacen IS NOT NULL;

-- 2. Asignar almacén activo por defecto a cualquier registro que quede NULL
UPDATE detalle_orden_compra
SET id_almacen = (SELECT MIN(id_almacen) FROM almacen WHERE estado = 'ACTIVO')
WHERE id_almacen IS NULL;

UPDATE detalle_nota_recepcion
SET id_almacen = (SELECT MIN(id_almacen) FROM almacen WHERE estado = 'ACTIVO')
WHERE id_almacen IS NULL;

-- Hacer obligatoria la columna id_almacen en detalle_nota_recepcion
ALTER TABLE detalle_nota_recepcion ALTER COLUMN id_almacen SET NOT NULL;
