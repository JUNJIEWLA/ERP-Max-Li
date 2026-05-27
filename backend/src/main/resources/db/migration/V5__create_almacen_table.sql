CREATE TABLE almacen (
    id_almacen         BIGSERIAL    PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL,
    descripcion        VARCHAR(255),
    estado             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_almacen_nombre UNIQUE (nombre),
    CONSTRAINT chk_almacen_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE INDEX idx_almacen_estado ON almacen (estado);
