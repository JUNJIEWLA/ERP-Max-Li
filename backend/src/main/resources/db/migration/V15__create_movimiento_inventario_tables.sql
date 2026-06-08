-- ============================================================
-- V15: Tablas de Movimientos de Inventario
-- Registra transferencias de mercancía entre ubicaciones.
-- ============================================================

CREATE TABLE movimiento (
    id_movimiento       BIGSERIAL     PRIMARY KEY,
    tipo                VARCHAR(30)   NOT NULL,
    id_almacen_origen   BIGINT,
    id_almacen_destino  BIGINT,
    referencia          VARCHAR(100),
    observacion         VARCHAR(500),
    estado              VARCHAR(20)   NOT NULL DEFAULT 'COMPLETADO',
    usuario_responsable VARCHAR(100)  NOT NULL,
    fecha_movimiento    TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_creacion      TIMESTAMP,
    fecha_modificacion  TIMESTAMP,
    CONSTRAINT fk_mov_almacen_origen  FOREIGN KEY (id_almacen_origen)  REFERENCES almacen (id_almacen),
    CONSTRAINT fk_mov_almacen_destino FOREIGN KEY (id_almacen_destino) REFERENCES almacen (id_almacen),
    CONSTRAINT chk_movimiento_tipo    CHECK (tipo IN ('TRANSFERENCIA','AJUSTE','ENTRADA','SALIDA')),
    CONSTRAINT chk_movimiento_estado  CHECK (estado IN ('COMPLETADO','ANULADO')),
    CONSTRAINT chk_movimiento_almacenes CHECK (
        (tipo = 'TRANSFERENCIA' AND id_almacen_origen IS NOT NULL AND id_almacen_destino IS NOT NULL AND id_almacen_origen <> id_almacen_destino)
        OR (tipo = 'ENTRADA' AND id_almacen_destino IS NOT NULL)
        OR (tipo = 'SALIDA' AND id_almacen_origen IS NOT NULL)
        OR (tipo = 'AJUSTE')
    )
);

CREATE TABLE detalle_movimiento (
    id_detalle_movimiento BIGSERIAL   PRIMARY KEY,
    id_movimiento         BIGINT      NOT NULL,
    id_producto           BIGINT      NOT NULL,
    cantidad              INTEGER     NOT NULL,
    CONSTRAINT fk_det_mov_movimiento FOREIGN KEY (id_movimiento) REFERENCES movimiento (id_movimiento),
    CONSTRAINT fk_det_mov_producto   FOREIGN KEY (id_producto)   REFERENCES producto (id_producto),
    CONSTRAINT chk_det_mov_cantidad  CHECK (cantidad > 0)
);

CREATE INDEX idx_movimiento_fecha   ON movimiento (fecha_movimiento);
CREATE INDEX idx_movimiento_tipo    ON movimiento (tipo);
CREATE INDEX idx_movimiento_estado  ON movimiento (estado);
CREATE INDEX idx_det_mov_movimiento ON detalle_movimiento (id_movimiento);
CREATE INDEX idx_det_mov_producto   ON detalle_movimiento (id_producto);
