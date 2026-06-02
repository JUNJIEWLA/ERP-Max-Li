CREATE TABLE movimiento_caja (
    id_movimiento     BIGSERIAL PRIMARY KEY,
    id_caja_chica     BIGINT        NOT NULL,
    id_usuario        BIGINT        NOT NULL,
    tipo_movimiento   VARCHAR(20)   NOT NULL,
    fecha_hora        TIMESTAMP     NOT NULL,
    monto             NUMERIC(12,2) NOT NULL,
    concepto          VARCHAR(255)  NOT NULL,
    CONSTRAINT fk_movimiento_caja_caja_chica FOREIGN KEY (id_caja_chica)
        REFERENCES caja_chica (id_caja_chica),
    CONSTRAINT fk_movimiento_caja_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
    CONSTRAINT chk_movimiento_caja_tipo CHECK (tipo_movimiento IN ('INGRESO', 'EGRESO')),
    CONSTRAINT chk_movimiento_caja_monto CHECK (monto > 0)
);

CREATE INDEX idx_movimiento_caja_id_caja_chica ON movimiento_caja (id_caja_chica);
CREATE INDEX idx_movimiento_caja_fecha_hora ON movimiento_caja (fecha_hora);
CREATE INDEX idx_movimiento_caja_tipo ON movimiento_caja (tipo_movimiento);
CREATE INDEX idx_movimiento_caja_id_usuario ON movimiento_caja (id_usuario);
