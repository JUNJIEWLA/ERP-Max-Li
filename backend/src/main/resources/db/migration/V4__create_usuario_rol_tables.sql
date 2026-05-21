CREATE TABLE rol (
    id_rol  BIGSERIAL    PRIMARY KEY,
    nombre  VARCHAR(50)  NOT NULL,
    CONSTRAINT uk_rol_nombre UNIQUE (nombre)
);

CREATE TABLE usuario (
    id_usuario         BIGSERIAL    PRIMARY KEY,
    username           VARCHAR(50)  NOT NULL,
    email              VARCHAR(150) NOT NULL,
    password_hash      VARCHAR(255) NOT NULL,
    estado             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion     TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_usuario_username UNIQUE (username),
    CONSTRAINT uk_usuario_email    UNIQUE (email),
    CONSTRAINT chk_usuario_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE usuario_rol (
    id_usuario BIGINT NOT NULL,
    id_rol     BIGINT NOT NULL,
    PRIMARY KEY (id_usuario, id_rol),
    CONSTRAINT fk_usuario_rol_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_usuario_rol_rol     FOREIGN KEY (id_rol)     REFERENCES rol     (id_rol)     ON DELETE CASCADE
);

CREATE INDEX idx_usuario_estado     ON usuario (estado);
CREATE INDEX idx_usuario_rol_usuario ON usuario_rol (id_usuario);
CREATE INDEX idx_usuario_rol_rol     ON usuario_rol (id_rol);

-- Roles base del sistema
INSERT INTO rol (nombre) VALUES ('ADMIN');
INSERT INTO rol (nombre) VALUES ('CAJERO');
INSERT INTO rol (nombre) VALUES ('SUPERVISOR');
