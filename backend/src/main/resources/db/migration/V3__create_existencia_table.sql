CREATE TABLE existencia (
    id_existencia      BIGSERIAL PRIMARY KEY,
    id_producto        BIGINT    NOT NULL UNIQUE,
    cantidad_actual    INTEGER   NOT NULL DEFAULT 0,
    cantidad_minima    INTEGER   NOT NULL DEFAULT 0,
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT fk_existencia_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
    CONSTRAINT chk_existencia_cantidad_actual CHECK (cantidad_actual >= 0),
    CONSTRAINT chk_existencia_cantidad_minima CHECK (cantidad_minima >= 0)
);

CREATE INDEX idx_existencia_id_producto ON existencia (id_producto);
CREATE INDEX idx_existencia_bajo_stock ON existencia (cantidad_actual, cantidad_minima);
