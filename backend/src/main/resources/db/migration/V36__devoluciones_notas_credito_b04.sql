-- ═══════════════════════════════════════════════════════════════════
--  V36: Devoluciones de venta y Notas de Crédito B04
--
--  Una devolución confirmada es UNA sola operación: repone inventario
--  en el almacén de la venta original, emite exactamente una Nota de
--  Crédito B04 que referencia el NCF afectado y ajusta la caja del
--  turno en que se reembolsa.
--
--  Esta migración solo amplía restricciones existentes: ningún valor
--  que antes era inválido pasa a serlo por accidente.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. NCF: habilitar el tipo B04 (Nota de Crédito) ─────────────────
--  No se inserta ninguna resolución B04: los rangos los autoriza la
--  DGII y se registran desde la pantalla de NCF. Sin resolución activa
--  la devolución falla y revierte, que es el comportamiento correcto.
ALTER TABLE resolucion_ncf DROP CONSTRAINT chk_resolucion_ncf_tipo_prefijo;

ALTER TABLE resolucion_ncf
    ADD CONSTRAINT chk_resolucion_ncf_tipo_prefijo
        CHECK (tipo_ncf IN ('B01', 'B02', 'B04', 'B14', 'B15') AND prefijo = tipo_ncf);

-- ── 2. Inventario: movimiento de tipo DEVOLUCION ────────────────────
--  Es una entrada: exige almacén destino, igual que ENTRADA.
ALTER TABLE movimiento DROP CONSTRAINT chk_movimiento_tipo;
ALTER TABLE movimiento DROP CONSTRAINT chk_movimiento_almacenes;

ALTER TABLE movimiento
    ADD CONSTRAINT chk_movimiento_tipo
        CHECK (tipo IN ('TRANSFERENCIA', 'AJUSTE', 'ENTRADA', 'SALIDA', 'VENTA', 'DEVOLUCION')),
    ADD CONSTRAINT chk_movimiento_almacenes CHECK (
        (tipo = 'TRANSFERENCIA' AND id_almacen_origen IS NOT NULL
            AND id_almacen_destino IS NOT NULL AND id_almacen_origen <> id_almacen_destino)
        OR (tipo IN ('ENTRADA', 'DEVOLUCION') AND id_almacen_destino IS NOT NULL)
        OR (tipo IN ('SALIDA', 'VENTA') AND id_almacen_origen IS NOT NULL)
        OR (tipo = 'AJUSTE' AND (id_almacen_origen IS NOT NULL OR id_almacen_destino IS NOT NULL))
    );

-- ── 3. Caja: efectivo reembolsado durante el turno ──────────────────
--  El reembolso en efectivo sale del cajón, así que baja el monto
--  esperado del cierre. Se guarda aparte de `total_egresos` para que el
--  cuadre distinga un gasto de caja de una devolución al cliente, y
--  para que recalcular el turno tras una venta posterior no borre el
--  ajuste.
ALTER TABLE turno_caja
    ADD COLUMN total_devoluciones_efectivo DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- ── 4. Numeración interna de devoluciones ───────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_numero_control_devolucion START WITH 1 INCREMENT BY 1;

-- ── 5. Tabla: devolucion ────────────────────────────────────────────
CREATE TABLE devolucion (
    id_devolucion           BIGSERIAL       PRIMARY KEY,

    -- Origen: venta, turno del reembolso, cajero y almacén de reposición
    id_venta                BIGINT          NOT NULL REFERENCES venta (id_venta),
    id_turno_caja           BIGINT          NOT NULL REFERENCES turno_caja (id_turno_caja),
    id_usuario              BIGINT          NOT NULL REFERENCES usuario (id_usuario),
    id_almacen              BIGINT          NOT NULL REFERENCES almacen (id_almacen),

    -- Numeración interna y llave de idempotencia del cliente
    numero_control          VARCHAR(30)     NOT NULL,
    referencia_operacion    VARCHAR(80)     NOT NULL,

    motivo                  VARCHAR(300)    NOT NULL,
    estado                  VARCHAR(20)     NOT NULL DEFAULT 'CONFIRMADA',
    metodo_reembolso        VARCHAR(20)     NOT NULL,

    -- Comprobante emitido y comprobante afectado (datos fiscales de la
    -- venta original congelados para auditoría)
    ncf                     VARCHAR(20)     NOT NULL,
    tipo_ncf                VARCHAR(10)     NOT NULL DEFAULT 'B04',
    ncf_afectado            VARCHAR(20)     NOT NULL,
    tipo_ncf_afectado       VARCHAR(10),
    numero_control_venta    VARCHAR(30)     NOT NULL,
    nombre_cliente          VARCHAR(200),
    rnc_cliente             VARCHAR(20),

    -- Totales acreditados
    base_imponible          DECIMAL(14, 2)  NOT NULL,
    itbis                   DECIMAL(14, 2)  NOT NULL,
    total                   DECIMAL(14, 2)  NOT NULL,

    fecha_devolucion        TIMESTAMP       NOT NULL,
    fecha_creacion          TIMESTAMP       NOT NULL DEFAULT NOW(),
    fecha_modificacion      TIMESTAMP,

    -- Una repetición por reintento o doble clic choca aquí y la
    -- transacción entera revierte: ni stock, ni caja, ni NCF.
    CONSTRAINT uk_devolucion_referencia     UNIQUE (referencia_operacion),
    CONSTRAINT uk_devolucion_numero_control UNIQUE (numero_control),
    CONSTRAINT uk_devolucion_ncf            UNIQUE (ncf),
    CONSTRAINT chk_devolucion_estado   CHECK (estado IN ('CONFIRMADA')),
    CONSTRAINT chk_devolucion_metodo   CHECK (metodo_reembolso IN
        ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE')),
    CONSTRAINT chk_devolucion_totales  CHECK (
        base_imponible >= 0 AND itbis >= 0 AND total >= 0
        AND total = base_imponible + itbis
    )
);

CREATE INDEX idx_devolucion_venta ON devolucion (id_venta);
CREATE INDEX idx_devolucion_turno ON devolucion (id_turno_caja);
CREATE INDEX idx_devolucion_fecha ON devolucion (fecha_devolucion);

-- ── 6. Tabla: detalle_devolucion ────────────────────────────────────
--  Los importes son snapshots acreditados, calculados desde
--  `detalle_venta` y nunca desde el precio vigente del producto.
CREATE TABLE detalle_devolucion (
    id_detalle_devolucion   BIGSERIAL       PRIMARY KEY,
    id_devolucion           BIGINT          NOT NULL REFERENCES devolucion (id_devolucion),
    id_detalle_venta        BIGINT          NOT NULL REFERENCES detalle_venta (id_detalle_venta),
    id_producto             BIGINT          NOT NULL REFERENCES producto (id_producto),

    cantidad                INTEGER         NOT NULL,
    precio_unitario         DECIMAL(12, 2)  NOT NULL,
    tasa_itbis              DECIMAL(5, 2)   NOT NULL,

    descuento_acreditado    DECIMAL(14, 2)  NOT NULL DEFAULT 0.00,
    importe_acreditado      DECIMAL(14, 2)  NOT NULL,
    base_imponible_acreditada DECIMAL(14, 2) NOT NULL,
    itbis_acreditado        DECIMAL(14, 2)  NOT NULL,

    CONSTRAINT chk_det_dev_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_det_dev_importes CHECK (
        base_imponible_acreditada >= 0 AND itbis_acreditado >= 0
        AND descuento_acreditado >= 0 AND importe_acreditado >= 0
        AND importe_acreditado = base_imponible_acreditada + itbis_acreditado + descuento_acreditado
    ),
    -- Una misma línea de venta no puede repetirse dentro de la misma
    -- devolución: la solicitud la rechaza antes, esto lo garantiza.
    CONSTRAINT uk_det_dev_linea UNIQUE (id_devolucion, id_detalle_venta)
);

CREATE INDEX idx_det_dev_devolucion    ON detalle_devolucion (id_devolucion);
CREATE INDEX idx_det_dev_detalle_venta ON detalle_devolucion (id_detalle_venta);
