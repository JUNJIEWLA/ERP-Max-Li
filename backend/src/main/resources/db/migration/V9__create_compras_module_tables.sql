-- ============================================================
--  V9 — Módulo de Compras
--  Tablas: proveedor, orden_compra, detalle_orden_compra,
--          pago_proveedor, nota_recepcion, detalle_nota_recepcion
-- ============================================================

-- 1. Proveedor
CREATE TABLE proveedor (
    id_proveedor      BIGSERIAL PRIMARY KEY,
    nombre_empresa    VARCHAR(200) NOT NULL,
    rnc               VARCHAR(20)  NOT NULL,
    ubicacion         VARCHAR(300),
    vendedor          VARCHAR(100),
    telefono          VARCHAR(30),
    email             VARCHAR(150),
    estado            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion    TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_proveedor_rnc UNIQUE (rnc)
);

-- 2. Orden de Compra
CREATE TABLE orden_compra (
    id_orden_compra    BIGSERIAL PRIMARY KEY,
    id_proveedor       BIGINT        NOT NULL,
    total              NUMERIC(12,2) NOT NULL,
    estado             VARCHAR(30)   NOT NULL DEFAULT 'BORRADOR',
    fecha_orden        TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT fk_orden_compra_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedor (id_proveedor)
);

-- 3. Detalle de Orden de Compra
CREATE TABLE detalle_orden_compra (
    id_detalle_orden_compra BIGSERIAL PRIMARY KEY,
    id_orden_compra         BIGINT        NOT NULL,
    id_producto             BIGINT        NOT NULL,
    cantidad                INTEGER       NOT NULL,
    precio_unitario         NUMERIC(12,2) NOT NULL,
    subtotal                NUMERIC(12,2) NOT NULL,
    cantidad_recibida       INTEGER       NOT NULL DEFAULT 0,
    CONSTRAINT fk_doc_orden    FOREIGN KEY (id_orden_compra) REFERENCES orden_compra (id_orden_compra),
    CONSTRAINT fk_doc_producto FOREIGN KEY (id_producto)    REFERENCES producto (id_producto)
);

-- 4. Pago a Proveedor
CREATE TABLE pago_proveedor (
    id_pago_proveedor  BIGSERIAL PRIMARY KEY,
    id_orden_compra    BIGINT        NOT NULL,
    monto_pagado       NUMERIC(12,2) NOT NULL,
    metodo             VARCHAR(50)   NOT NULL,
    numero_referencia  VARCHAR(100),
    fecha              TIMESTAMP,
    CONSTRAINT fk_pago_orden FOREIGN KEY (id_orden_compra)
        REFERENCES orden_compra (id_orden_compra)
);

-- 5. Nota de Recepción
CREATE TABLE nota_recepcion (
    id_nota_recepcion  BIGSERIAL PRIMARY KEY,
    id_orden_compra    BIGINT      NOT NULL,
    estado             VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    fecha_recepcion    TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT fk_nota_orden FOREIGN KEY (id_orden_compra)
        REFERENCES orden_compra (id_orden_compra)
);

-- 6. Detalle de Nota de Recepción
CREATE TABLE detalle_nota_recepcion (
    id_detalle_nota_recepcion BIGSERIAL PRIMARY KEY,
    id_nota_recepcion         BIGINT      NOT NULL,
    id_detalle_orden_compra   BIGINT      NOT NULL,
    cantidad_recibida         INTEGER     NOT NULL,
    observacion               VARCHAR(50) NOT NULL,
    notas                     VARCHAR(500),
    CONSTRAINT fk_dnr_nota   FOREIGN KEY (id_nota_recepcion)       REFERENCES nota_recepcion (id_nota_recepcion),
    CONSTRAINT fk_dnr_detalle FOREIGN KEY (id_detalle_orden_compra) REFERENCES detalle_orden_compra (id_detalle_orden_compra)
);
