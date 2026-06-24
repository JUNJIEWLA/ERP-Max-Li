-- ════════════════════════════════════════════════════════════════════
--  V20 — Fecha de llegada acordada en OC + Alertas de retraso + Crédito en cliente
-- ════════════════════════════════════════════════════════════════════

-- ── Parte 1: Fecha acordada con el proveedor en la orden de compra ──
ALTER TABLE orden_compra
    ADD COLUMN fecha_llegada_acordada DATE NULL;

COMMENT ON COLUMN orden_compra.fecha_llegada_acordada IS 'Fecha comprometida por el proveedor para la entrega. NULL = sin fecha acordada';

-- ── Parte 2: Tabla de alertas de retraso de órdenes de compra ───────
CREATE TABLE alerta_retraso_oc
(
    id_alerta_retraso  BIGSERIAL PRIMARY KEY,
    id_orden_compra    BIGINT      NOT NULL,
    dias_retraso       INT         NOT NULL DEFAULT 0,
    estado             VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    fecha_creacion     TIMESTAMP   NOT NULL,
    fecha_modificacion TIMESTAMP,

    CONSTRAINT fk_aro_orden FOREIGN KEY (id_orden_compra) REFERENCES orden_compra (id_orden_compra),
    CONSTRAINT uq_aro_orden UNIQUE (id_orden_compra)
);

CREATE INDEX idx_aro_orden_estado ON alerta_retraso_oc (id_orden_compra, estado);

COMMENT ON COLUMN alerta_retraso_oc.dias_retraso IS 'Días transcurridos desde la fecha acordada. Se actualiza cada ejecución del scheduler.';
COMMENT ON COLUMN alerta_retraso_oc.estado IS 'PENDIENTE = visible en buzón | LEIDA = descartada por el usuario';

-- ── Parte 3: Límites de crédito en cliente ──────────────────────────
ALTER TABLE cliente
    ADD COLUMN dias_credito          INT           NOT NULL DEFAULT 0,
    ADD COLUMN monto_limite_credito  DECIMAL(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN cliente.dias_credito IS 'Días de plazo de crédito otorgados al cliente. 0 = sin crédito';
COMMENT ON COLUMN cliente.monto_limite_credito IS 'Monto máximo de crédito autorizado en DOP. 0 = sin crédito. Ambos campos deben ser > 0 para activar crédito';
