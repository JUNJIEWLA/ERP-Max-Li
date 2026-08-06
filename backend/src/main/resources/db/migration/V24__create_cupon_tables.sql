-- ═══════════════════════════════════════════════════════
-- V24 – Módulo de Cupones de Descuento
-- ═══════════════════════════════════════════════════════

CREATE TABLE cupon (
    id_cupon              BIGSERIAL       PRIMARY KEY,
    codigo_interno        VARCHAR(30)     NOT NULL UNIQUE,       -- CUPON-01
    codigo_secreto        VARCHAR(50)     NOT NULL UNIQUE,       -- NAVIDAD2026
    tipo_descuento        VARCHAR(20)     NOT NULL,              -- MONTO_FIJO | PORCENTAJE
    valor_descuento       NUMERIC(12, 2)  NOT NULL,
    aplica_todas_categorias BOOLEAN       NOT NULL DEFAULT TRUE,
    monto_minimo_compra   NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    fecha_inicio          DATE            NOT NULL,
    fecha_fin             DATE,
    limite_usos           INTEGER         NOT NULL DEFAULT 1,
    usos_actuales         INTEGER         NOT NULL DEFAULT 0,
    estado                VARCHAR(20)     NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion        TIMESTAMP,
    fecha_modificacion    TIMESTAMP,
    CONSTRAINT chk_cupon_tipo       CHECK (tipo_descuento IN ('MONTO_FIJO', 'PORCENTAJE')),
    CONSTRAINT chk_cupon_estado     CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT chk_cupon_valor      CHECK (valor_descuento > 0),
    CONSTRAINT chk_cupon_porcentaje CHECK (tipo_descuento <> 'PORCENTAJE' OR valor_descuento <= 100),
    CONSTRAINT chk_cupon_fechas     CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT chk_cupon_usos       CHECK (limite_usos > 0)
);

-- Tabla de relación many-to-many Cupón ↔ Categoría (sólo aplica cuando aplica_todas_categorias = FALSE)
CREATE TABLE cupon_categoria (
    id_cupon     BIGINT NOT NULL,
    id_categoria BIGINT NOT NULL,
    PRIMARY KEY (id_cupon, id_categoria),
    CONSTRAINT fk_cupon_cat_cupon     FOREIGN KEY (id_cupon)     REFERENCES cupon (id_cupon)         ON DELETE CASCADE,
    CONSTRAINT fk_cupon_cat_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
);

CREATE INDEX idx_cupon_codigo_secreto ON cupon (codigo_secreto);
CREATE INDEX idx_cupon_estado         ON cupon (estado);
CREATE INDEX idx_cupon_vigencia       ON cupon (estado, fecha_inicio, fecha_fin);
