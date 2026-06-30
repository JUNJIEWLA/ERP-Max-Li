CREATE TABLE oferta (
    id_oferta          BIGSERIAL     PRIMARY KEY,
    nombre             VARCHAR(120)  NOT NULL,
    descripcion        VARCHAR(255),
    tipo               VARCHAR(20)   NOT NULL,
    id_producto        BIGINT        NOT NULL,
    fecha_inicio       DATE          NOT NULL,
    fecha_fin          DATE,
    estado             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT fk_oferta_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
    CONSTRAINT chk_oferta_tipo CHECK (tipo IN ('CANTIDAD', 'DESCUENTO')),
    CONSTRAINT chk_oferta_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT chk_oferta_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE oferta_cantidad (
    id_oferta_cantidad BIGSERIAL PRIMARY KEY,
    id_oferta          BIGINT    NOT NULL,
    cantidad_requerida INTEGER   NOT NULL,
    cantidad_pagada    INTEGER   NOT NULL,
    CONSTRAINT uk_oferta_cantidad_oferta UNIQUE (id_oferta),
    CONSTRAINT fk_oferta_cantidad_oferta FOREIGN KEY (id_oferta) REFERENCES oferta (id_oferta),
    CONSTRAINT chk_oferta_cantidad_requerida CHECK (cantidad_requerida > 1),
    CONSTRAINT chk_oferta_cantidad_pagada CHECK (cantidad_pagada > 0 AND cantidad_pagada < cantidad_requerida)
);

CREATE TABLE oferta_descuento (
    id_oferta_descuento BIGSERIAL     PRIMARY KEY,
    id_oferta           BIGINT        NOT NULL,
    porcentaje_descuento NUMERIC(5,2) NOT NULL,
    CONSTRAINT uk_oferta_descuento_oferta UNIQUE (id_oferta),
    CONSTRAINT fk_oferta_descuento_oferta FOREIGN KEY (id_oferta) REFERENCES oferta (id_oferta),
    CONSTRAINT chk_oferta_descuento_porcentaje CHECK (porcentaje_descuento > 0 AND porcentaje_descuento <= 100)
);

CREATE INDEX idx_oferta_producto ON oferta (id_producto);
CREATE INDEX idx_oferta_estado ON oferta (estado);
CREATE INDEX idx_oferta_tipo ON oferta (tipo);
CREATE INDEX idx_oferta_vigencia ON oferta (estado, fecha_inicio, fecha_fin);
