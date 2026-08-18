-- Agregar columna fecha_vencimiento_ncf a la tabla venta para trazabilidad fiscal
ALTER TABLE venta ADD COLUMN fecha_vencimiento_ncf DATE NULL;
