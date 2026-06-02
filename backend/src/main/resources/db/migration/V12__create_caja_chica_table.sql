CREATE TABLE caja_chica (
    id_caja_chica      BIGSERIAL PRIMARY KEY,
    nombre             VARCHAR(100)  NOT NULL,
    responsable        VARCHAR(100)  NOT NULL,
    saldo_actual       NUMERIC(12,2) NOT NULL DEFAULT 0,
    limite_monto       NUMERIC(12,2) NOT NULL,
    estado             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_caja_chica_nombre UNIQUE (nombre),
    CONSTRAINT chk_caja_chica_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT chk_caja_chica_saldo_actual CHECK (saldo_actual >= 0),
    CONSTRAINT chk_caja_chica_limite_monto CHECK (limite_monto > 0),
    CONSTRAINT chk_caja_chica_saldo_limite CHECK (saldo_actual <= limite_monto)
);

CREATE INDEX idx_caja_chica_estado ON caja_chica (estado);
CREATE INDEX idx_caja_chica_nombre ON caja_chica (nombre);
