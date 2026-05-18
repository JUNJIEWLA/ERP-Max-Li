CREATE TABLE caja (
    id_caja           BIGSERIAL    PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    estado            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion    TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT chk_caja_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE INDEX idx_caja_estado ON caja (estado);
