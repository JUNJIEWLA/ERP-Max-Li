-- El módulo heredado deja de procesar pagos parciales y pasa a ser un gasto
-- asociado a una compra ya recibida. La tabla heredada se elimina intencionalmente.
DROP TABLE IF EXISTS pago_proveedor;

CREATE TABLE gasto (
    id_gasto          BIGSERIAL PRIMARY KEY,
    id_orden_compra   BIGINT        NOT NULL UNIQUE,
    monto             NUMERIC(12,2) NOT NULL,
    estado            VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
    fecha_registro    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_realizado   TIMESTAMP,
    CONSTRAINT fk_gasto_orden FOREIGN KEY (id_orden_compra)
        REFERENCES orden_compra (id_orden_compra),
    CONSTRAINT ck_gasto_estado CHECK (estado IN ('PENDIENTE', 'REALIZADO'))
);

CREATE INDEX idx_gasto_estado ON gasto (estado);

UPDATE permiso
SET descripcion = 'Crear órdenes de compra, notas de recepción y gastos de proveedores'
WHERE nombre_clave = 'COMPRA_GESTIONAR';
