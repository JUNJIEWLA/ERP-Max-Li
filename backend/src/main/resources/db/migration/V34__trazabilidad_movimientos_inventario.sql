-- ISSUE-005: completar la trazabilidad de cada cambio de existencia.
-- Las columnas quedan nullable para conservar movimientos históricos creados
-- antes de esta migración, cuyos saldos no pueden reconstruirse con certeza.

ALTER TABLE detalle_movimiento
    ADD COLUMN cantidad_anterior_origen INTEGER,
    ADD COLUMN cantidad_posterior_origen INTEGER,
    ADD COLUMN cantidad_anterior_destino INTEGER,
    ADD COLUMN cantidad_posterior_destino INTEGER;

ALTER TABLE detalle_movimiento
    ADD CONSTRAINT chk_det_mov_saldos_no_negativos CHECK (
        (cantidad_anterior_origen IS NULL OR cantidad_anterior_origen >= 0)
        AND (cantidad_posterior_origen IS NULL OR cantidad_posterior_origen >= 0)
        AND (cantidad_anterior_destino IS NULL OR cantidad_anterior_destino >= 0)
        AND (cantidad_posterior_destino IS NULL OR cantidad_posterior_destino >= 0)
    ),
    ADD CONSTRAINT chk_det_mov_pares_saldos CHECK (
        (cantidad_anterior_origen IS NULL) = (cantidad_posterior_origen IS NULL)
        AND (cantidad_anterior_destino IS NULL) = (cantidad_posterior_destino IS NULL)
    ),
    ADD CONSTRAINT chk_det_mov_cantidad_concilia CHECK (
        (cantidad_anterior_origen IS NULL
            OR ABS(cantidad_posterior_origen - cantidad_anterior_origen) = cantidad)
        AND (cantidad_anterior_destino IS NULL
            OR ABS(cantidad_posterior_destino - cantidad_anterior_destino) = cantidad)
    );

ALTER TABLE movimiento DROP CONSTRAINT chk_movimiento_tipo;
ALTER TABLE movimiento DROP CONSTRAINT chk_movimiento_almacenes;

ALTER TABLE movimiento
    ADD CONSTRAINT chk_movimiento_tipo
        CHECK (tipo IN ('TRANSFERENCIA','AJUSTE','ENTRADA','SALIDA','VENTA')),
    ADD CONSTRAINT chk_movimiento_almacenes CHECK (
        (tipo = 'TRANSFERENCIA' AND id_almacen_origen IS NOT NULL
            AND id_almacen_destino IS NOT NULL AND id_almacen_origen <> id_almacen_destino)
        OR (tipo = 'ENTRADA' AND id_almacen_destino IS NOT NULL)
        OR (tipo IN ('SALIDA', 'VENTA') AND id_almacen_origen IS NOT NULL)
        OR (tipo = 'AJUSTE' AND (id_almacen_origen IS NOT NULL OR id_almacen_destino IS NOT NULL))
    );
