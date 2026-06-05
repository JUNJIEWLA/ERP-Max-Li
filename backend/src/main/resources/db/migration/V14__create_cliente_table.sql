-- ============================================================
--  V14 — Módulo de Clientes
--  Tabla: cliente
--  Pre-inserta el registro genérico "Consumidor Final" (id=1)
-- ============================================================

CREATE TABLE cliente (
    id_cliente               BIGSERIAL     PRIMARY KEY,
    nombre_completo          VARCHAR(200)  NOT NULL,
    rnc_cedula               VARCHAR(20)   NULL,
    telefono                 VARCHAR(30)   NULL,
    email                    VARCHAR(150)  NULL,
    direccion                VARCHAR(300)  NULL,
    tipo_ncf_preferido       VARCHAR(10)   NOT NULL DEFAULT 'B02',
    descuento_predeterminado NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
    total_compras            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    estado                   VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion           TIMESTAMP,
    fecha_modificacion       TIMESTAMP,
    CONSTRAINT ck_cliente_descuento CHECK (descuento_predeterminado BETWEEN 0 AND 100),
    CONSTRAINT ck_cliente_total     CHECK (total_compras >= 0),
    CONSTRAINT ck_cliente_estado    CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

-- Índice único en RNC/cédula (solo cuando no nulo, evita colisiones de nulos múltiples)
CREATE UNIQUE INDEX uk_cliente_rnc_cedula ON cliente (rnc_cedula) WHERE rnc_cedula IS NOT NULL;

-- Índice para búsqueda rápida en POS
CREATE INDEX idx_cliente_nombre ON cliente (nombre_completo);

-- ── Registro genérico pre-insertado ──────────────────────────
-- ID=1 reservado para "Consumidor Final". Todas las ventas sin
-- cliente explícito referenciarán este registro.
INSERT INTO cliente (id_cliente, nombre_completo, tipo_ncf_preferido, descuento_predeterminado,
                     total_compras, estado, fecha_creacion, fecha_modificacion)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Consumidor Final', 'B02', 0.00, 0.00, 'ACTIVO', NOW(), NOW());

-- Adelantar la secuencia para que el próximo BIGSERIAL empiece en 2
SELECT setval('cliente_id_cliente_seq', 1, true);
