-- ═══════════════════════════════════════════════════════════════════
--  V41: Añadir campos de saldo para Nota de Crédito en devolucion y turno_caja
--
--  Permite rastrear el saldo disponible de las Notas de Crédito emitidas
--  por devoluciones y su consumo como método de pago en el POS.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE devolucion
    ADD COLUMN IF NOT EXISTS monto_disponible NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS monto_usado NUMERIC(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN devolucion.monto_disponible
    IS 'Saldo disponible de la Nota de Crédito para ser usado en compras posteriores.';

COMMENT ON COLUMN devolucion.monto_usado
    IS 'Monto consumido acumulado de la Nota de Crédito.';

-- Inicializar monto_disponible en devoluciones confirmadas existentes
UPDATE devolucion
SET monto_disponible = total,
    monto_usado = 0.00
WHERE estado = 'CONFIRMADA' AND monto_disponible = 0.00 AND monto_usado = 0.00;

ALTER TABLE turno_caja
    ADD COLUMN IF NOT EXISTS total_ventas_nota_credito NUMERIC(12,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN turno_caja.total_ventas_nota_credito
    IS 'Monto total acumulado de ventas cobradas con Nota de Crédito durante el turno.';
