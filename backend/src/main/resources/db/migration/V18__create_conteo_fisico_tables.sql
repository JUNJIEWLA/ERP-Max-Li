-- =====================================================================
-- V18: Módulo de Conteo Físico (Toma de Inventario)
-- Tablas: conteo_cabecera, conteo_detalle
-- =====================================================================

-- ── Cabecera del documento de conteo ─────────────────────────────────
CREATE TABLE conteo_cabecera (
    id_conteo            BIGSERIAL    PRIMARY KEY,
    id_almacen           BIGINT       NOT NULL REFERENCES almacen(id_almacen),
    zona                 VARCHAR(100),
    estado               VARCHAR(20)  NOT NULL DEFAULT 'EN_PROCESO',
    id_usuario_asignado  BIGINT       NOT NULL REFERENCES usuario(id_usuario),
    id_usuario_supervisor BIGINT      REFERENCES usuario(id_usuario),
    observacion          VARCHAR(500),
    fecha_aplicacion     TIMESTAMP,
    fecha_creacion       TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_modificacion   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_conteo_estado CHECK (estado IN ('EN_PROCESO', 'REVISION', 'APLICADO', 'ANULADO'))
);

-- ── Detalle: líneas de conteo por producto ───────────────────────────
CREATE TABLE conteo_detalle (
    id_conteo_detalle  BIGSERIAL  PRIMARY KEY,
    id_conteo          BIGINT     NOT NULL REFERENCES conteo_cabecera(id_conteo),
    id_producto        BIGINT     NOT NULL REFERENCES producto(id_producto),
    cantidad_fisica    INT        NOT NULL CHECK (cantidad_fisica >= 0),
    cantidad_sistema   INT,
    diferencia         INT,
    fecha_registro     TIMESTAMP  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_conteo_producto UNIQUE (id_conteo, id_producto)
);

-- ── Índices ──────────────────────────────────────────────────────────
CREATE INDEX idx_conteo_cabecera_estado   ON conteo_cabecera(estado);
CREATE INDEX idx_conteo_cabecera_almacen  ON conteo_cabecera(id_almacen);
CREATE INDEX idx_conteo_cabecera_usuario  ON conteo_cabecera(id_usuario_asignado);
CREATE INDEX idx_conteo_detalle_conteo    ON conteo_detalle(id_conteo);
