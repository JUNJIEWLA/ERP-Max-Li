-- =========================================================================
-- V25: Módulo POS — Ventas, Detalles, Ingresos (pagos mixtos)
-- =========================================================================

-- ── 1. ALTERs a tablas existentes ────────────────────────────────────────

-- Categoría: margen al por mayor
ALTER TABLE categoria
    ADD COLUMN porcentaje_margen_mayor DECIMAL(5, 2) NOT NULL DEFAULT 0.00;

-- Producto: precio mayorista, ITBIS variable, cantidad mínima mayorista
ALTER TABLE producto
    ADD COLUMN precio_venta_mayor DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN tasa_itbis          DECIMAL(5, 2)  NOT NULL DEFAULT 18.00,
    ADD COLUMN cantidad_minima_mayor INTEGER       NOT NULL DEFAULT 1;

-- Turno de caja: separar cheque y cupón para Cierre Z
ALTER TABLE turno_caja
    ADD COLUMN total_ventas_cheque DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN total_ventas_cupon  DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- ── 2. Secuencia para número de control interno ─────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_numero_control_venta START WITH 1 INCREMENT BY 1;

-- ── 3. Tabla: venta ─────────────────────────────────────────────────────

CREATE TABLE venta (
    id_venta                BIGSERIAL       PRIMARY KEY,
    id_turno_caja           BIGINT          NOT NULL REFERENCES turno_caja(id_turno_caja),
    id_usuario              BIGINT          NOT NULL REFERENCES usuario(id_usuario),

    -- Cliente registrado (opcional)
    id_cliente              BIGINT          REFERENCES cliente(id_cliente),

    -- Cliente de paso: nombre + RNC temporal (NO crea registro en cliente)
    nombre_cliente_temporal VARCHAR(200),
    rnc_temporal            VARCHAR(20),

    -- Numeración interna
    numero_control          VARCHAR(30)     NOT NULL,

    -- Comprobante fiscal (NCF)
    ncf                     VARCHAR(20),
    tipo_ncf                VARCHAR(10),

    -- Método de pago principal (EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE, MIXTO)
    metodo_pago_principal   VARCHAR(20)     NOT NULL,

    -- Control de precio mayorista
    usa_precio_mayor        BOOLEAN         NOT NULL DEFAULT false,

    -- Totales financieros
    subtotal                DECIMAL(14, 2)  NOT NULL,
    descuento_total         DECIMAL(14, 2)  NOT NULL DEFAULT 0.00,
    itbis                   DECIMAL(14, 2)  NOT NULL DEFAULT 0.00,
    total                   DECIMAL(14, 2)  NOT NULL,
    monto_recibido          DECIMAL(14, 2),
    cambio                  DECIMAL(14, 2),

    -- Cupón
    codigo_cupon            VARCHAR(50),
    descuento_cupon         DECIMAL(14, 2)  DEFAULT 0.00,

    -- Estado
    estado                  VARCHAR(20)     NOT NULL DEFAULT 'COMPLETADA',

    -- Auditoría
    fecha_venta             TIMESTAMP       NOT NULL,
    fecha_creacion          TIMESTAMP       NOT NULL DEFAULT NOW(),
    fecha_modificacion      TIMESTAMP,

    CONSTRAINT uk_venta_numero_control UNIQUE (numero_control)
);

CREATE INDEX idx_venta_fecha_estado ON venta (fecha_venta, estado);
CREATE INDEX idx_venta_turno ON venta (id_turno_caja);

-- ── 4. Tabla: detalle_venta ─────────────────────────────────────────────

CREATE TABLE detalle_venta (
    id_detalle_venta        BIGSERIAL       PRIMARY KEY,
    id_venta                BIGINT          NOT NULL REFERENCES venta(id_venta),
    id_producto             BIGINT          NOT NULL REFERENCES producto(id_producto),
    cantidad                INTEGER         NOT NULL,

    -- Precio aplicado y original (para tracking de recálculo)
    precio_unitario         DECIMAL(12, 2)  NOT NULL,
    precio_unitario_original DECIMAL(12, 2),
    tipo_precio             VARCHAR(20)     NOT NULL DEFAULT 'DETALLE',

    -- Tasa ITBIS snapshot del momento de la venta
    tasa_itbis              DECIMAL(5, 2)   NOT NULL DEFAULT 18.00,

    -- Descuentos
    descuento_linea         DECIMAL(5, 2)   DEFAULT 0.00,
    descuento_oferta        DECIMAL(12, 2)  DEFAULT 0.00,
    oferta_aplicada         VARCHAR(120),

    -- Importe final de la línea
    importe                 DECIMAL(14, 2)  NOT NULL
);

CREATE INDEX idx_detalle_venta_venta ON detalle_venta (id_venta);

-- ── 5. Tabla: ingreso_venta (pagos mixtos) ──────────────────────────────

CREATE TABLE ingreso_venta (
    id_ingreso_venta        BIGSERIAL       PRIMARY KEY,
    id_venta                BIGINT          NOT NULL REFERENCES venta(id_venta),
    metodo_pago             VARCHAR(20)     NOT NULL,
    monto                   DECIMAL(14, 2)  NOT NULL,
    referencia              VARCHAR(100),
    fecha_registro          TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingreso_venta_venta ON ingreso_venta (id_venta);
