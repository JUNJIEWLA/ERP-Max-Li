-- ============================================================
--  V17 — Margen por Categoría + Historial de Costos + Buzón de Alertas
-- ============================================================

-- 1. Agregar porcentaje_margen a categoría
ALTER TABLE categoria
    ADD COLUMN porcentaje_margen NUMERIC(5,2) NOT NULL DEFAULT 0;

-- 2. Tabla historial_costo: registra cada cambio de costo de un producto
CREATE TABLE historial_costo (
    id_historial_costo   BIGSERIAL      PRIMARY KEY,
    id_producto          BIGINT         NOT NULL,
    id_nota_recepcion    BIGINT         NOT NULL,
    id_proveedor         BIGINT         NOT NULL,
    costo_anterior       NUMERIC(12,2)  NOT NULL,
    costo_nuevo          NUMERIC(12,2)  NOT NULL,
    cantidad_recibida    INTEGER        NOT NULL,
    fecha_registro       TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_hc_producto  FOREIGN KEY (id_producto)       REFERENCES producto (id_producto),
    CONSTRAINT fk_hc_nota      FOREIGN KEY (id_nota_recepcion) REFERENCES nota_recepcion (id_nota_recepcion),
    CONSTRAINT fk_hc_proveedor FOREIGN KEY (id_proveedor)      REFERENCES proveedor (id_proveedor)
);

CREATE INDEX idx_hc_producto ON historial_costo (id_producto);
CREATE INDEX idx_hc_fecha    ON historial_costo (fecha_registro DESC);

-- 3. Tabla alerta_costo: buzón persistente de alertas de variación de costo
CREATE TABLE alerta_costo (
    id_alerta_costo       BIGSERIAL      PRIMARY KEY,
    id_producto           BIGINT         NOT NULL,
    id_nota_recepcion     BIGINT         NOT NULL,
    nombre_producto       VARCHAR(150)   NOT NULL,
    costo_anterior        NUMERIC(12,2)  NOT NULL,
    costo_nuevo           NUMERIC(12,2)  NOT NULL,
    precio_venta_actual   NUMERIC(12,2)  NOT NULL,
    precio_venta_sugerido NUMERIC(12,2)  NOT NULL,
    porcentaje_variacion  NUMERIC(8,2)   NOT NULL,
    porcentaje_margen     NUMERIC(5,2)   NOT NULL,
    estado                VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE',
    fecha_creacion        TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_resolucion      TIMESTAMP,
    CONSTRAINT fk_ac_producto FOREIGN KEY (id_producto)       REFERENCES producto (id_producto),
    CONSTRAINT fk_ac_nota     FOREIGN KEY (id_nota_recepcion) REFERENCES nota_recepcion (id_nota_recepcion),
    CONSTRAINT chk_ac_estado  CHECK (estado IN ('PENDIENTE', 'APLICADA', 'DESCARTADA'))
);

CREATE INDEX idx_ac_estado ON alerta_costo (estado);
CREATE INDEX idx_ac_producto ON alerta_costo (id_producto);
CREATE INDEX idx_ac_fecha ON alerta_costo (fecha_creacion DESC);
