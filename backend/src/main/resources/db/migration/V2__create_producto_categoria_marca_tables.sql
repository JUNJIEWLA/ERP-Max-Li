CREATE TABLE categoria (
    id_categoria       BIGSERIAL    PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL,
    descripcion        VARCHAR(255),
    estado             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_categoria_nombre UNIQUE (nombre),
    CONSTRAINT chk_categoria_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE marca (
    id_marca           BIGSERIAL    PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL,
    descripcion        VARCHAR(255),
    estado             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_marca_nombre UNIQUE (nombre),
    CONSTRAINT chk_marca_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE producto (
    id_producto        BIGSERIAL     PRIMARY KEY,
    codigo             VARCHAR(50)   NOT NULL,
    nombre             VARCHAR(150)  NOT NULL,
    descripcion        VARCHAR(500),
    precio_venta       NUMERIC(12,2) NOT NULL,
    costo              NUMERIC(12,2) NOT NULL,
    estado             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    id_categoria       BIGINT        NOT NULL,
    id_marca           BIGINT        NOT NULL,
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_producto_codigo UNIQUE (codigo),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria),
    CONSTRAINT fk_producto_marca FOREIGN KEY (id_marca) REFERENCES marca (id_marca),
    CONSTRAINT chk_producto_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT chk_producto_precio_venta CHECK (precio_venta >= 0),
    CONSTRAINT chk_producto_costo CHECK (costo >= 0)
);

CREATE INDEX idx_categoria_estado ON categoria (estado);
CREATE INDEX idx_marca_estado ON marca (estado);
CREATE INDEX idx_producto_estado ON producto (estado);
CREATE INDEX idx_producto_id_categoria ON producto (id_categoria);
CREATE INDEX idx_producto_id_marca ON producto (id_marca);
