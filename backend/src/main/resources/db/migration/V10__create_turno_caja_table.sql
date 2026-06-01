CREATE TABLE turno_caja (
    id_turno_caja         BIGSERIAL PRIMARY KEY,
    id_caja               BIGINT        NOT NULL,
    id_usuario_apertura   BIGINT        NOT NULL,
    id_usuario_cierre     BIGINT,
    monto_inicial         NUMERIC(12,2) NOT NULL,
    monto_final_declarado NUMERIC(12,2),
    estado                VARCHAR(20)   NOT NULL DEFAULT 'ABIERTO',
    observacion_apertura  VARCHAR(500),
    observacion_cierre    VARCHAR(500),
    fecha_apertura        TIMESTAMP     NOT NULL,
    fecha_cierre          TIMESTAMP,
    fecha_modificacion    TIMESTAMP,
    CONSTRAINT fk_turno_caja_caja FOREIGN KEY (id_caja)
        REFERENCES caja (id_caja),
    CONSTRAINT fk_turno_caja_usuario_apertura FOREIGN KEY (id_usuario_apertura)
        REFERENCES usuario (id_usuario),
    CONSTRAINT fk_turno_caja_usuario_cierre FOREIGN KEY (id_usuario_cierre)
        REFERENCES usuario (id_usuario),
    CONSTRAINT chk_turno_caja_estado CHECK (estado IN ('ABIERTO', 'CERRADO')),
    CONSTRAINT chk_turno_caja_monto_inicial CHECK (monto_inicial >= 0),
    CONSTRAINT chk_turno_caja_monto_final CHECK (monto_final_declarado IS NULL OR monto_final_declarado >= 0),
    CONSTRAINT chk_turno_caja_cierre CHECK (
        (estado = 'ABIERTO'
            AND fecha_cierre IS NULL
            AND id_usuario_cierre IS NULL
            AND monto_final_declarado IS NULL)
        OR
        (estado = 'CERRADO'
            AND fecha_cierre IS NOT NULL
            AND id_usuario_cierre IS NOT NULL
            AND monto_final_declarado IS NOT NULL)
    )
);

CREATE INDEX idx_turno_caja_estado ON turno_caja (estado);
CREATE INDEX idx_turno_caja_id_caja ON turno_caja (id_caja);
CREATE INDEX idx_turno_caja_id_usuario_apertura ON turno_caja (id_usuario_apertura);
CREATE INDEX idx_turno_caja_fecha_apertura ON turno_caja (fecha_apertura);

CREATE UNIQUE INDEX uk_turno_caja_abierto_por_caja
    ON turno_caja (id_caja)
    WHERE estado = 'ABIERTO';

CREATE UNIQUE INDEX uk_turno_caja_abierto_por_usuario
    ON turno_caja (id_usuario_apertura)
    WHERE estado = 'ABIERTO';
