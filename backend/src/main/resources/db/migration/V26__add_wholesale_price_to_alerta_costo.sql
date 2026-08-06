-- =========================================================================
-- V26: Wholesale price tracking en alertas de costo
--      + Índice adicional en categoría para margen mayorista
-- =========================================================================

-- Columnas para precio mayorista en el buzón de alertas
ALTER TABLE alerta_costo
    ADD COLUMN precio_venta_mayor_actual   NUMERIC(12, 2),
    ADD COLUMN precio_venta_mayor_sugerido NUMERIC(12, 2),
    ADD COLUMN porcentaje_margen_mayor     NUMERIC(5, 2);

-- Comentario aclaratorio
COMMENT ON COLUMN alerta_costo.precio_venta_mayor_actual   IS 'Precio al por mayor vigente al momento de la alerta';
COMMENT ON COLUMN alerta_costo.precio_venta_mayor_sugerido IS 'Precio al por mayor sugerido = costoNuevo × (1 + margenMayor/100)';
COMMENT ON COLUMN alerta_costo.porcentaje_margen_mayor     IS 'Porcentaje de margen mayorista de la categoría al momento de la alerta';
