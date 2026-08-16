-- =========================================================================
-- V32: ISSUE-008 — base imponible e ITBIS calculados por línea de venta
-- =========================================================================

ALTER TABLE detalle_venta
    ADD COLUMN descuento_prorrateado DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN base_imponible        DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN itbis_linea           DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
