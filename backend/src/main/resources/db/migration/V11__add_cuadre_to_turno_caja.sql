ALTER TABLE turno_caja
    ADD COLUMN total_ventas_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_ventas_tarjeta NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_ventas_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_otros_ingresos NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_egresos NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN monto_esperado NUMERIC(12,2),
    ADD COLUMN diferencia NUMERIC(12,2);

UPDATE turno_caja
SET monto_esperado = monto_inicial + total_ventas_efectivo + total_otros_ingresos - total_egresos
WHERE monto_esperado IS NULL;

ALTER TABLE turno_caja
    ALTER COLUMN monto_esperado SET NOT NULL,
    ADD CONSTRAINT chk_turno_caja_total_ventas_efectivo CHECK (total_ventas_efectivo >= 0),
    ADD CONSTRAINT chk_turno_caja_total_ventas_tarjeta CHECK (total_ventas_tarjeta >= 0),
    ADD CONSTRAINT chk_turno_caja_total_ventas_transferencia CHECK (total_ventas_transferencia >= 0),
    ADD CONSTRAINT chk_turno_caja_total_otros_ingresos CHECK (total_otros_ingresos >= 0),
    ADD CONSTRAINT chk_turno_caja_total_egresos CHECK (total_egresos >= 0),
    ADD CONSTRAINT chk_turno_caja_monto_esperado CHECK (monto_esperado >= 0);
