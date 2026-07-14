CREATE TABLE resolucion_ncf (
    id_resolucion BIGSERIAL PRIMARY KEY,
    tipo_ncf VARCHAR(10) NOT NULL,
    descripcion VARCHAR(100) NOT NULL,
    numero_resolucion VARCHAR(50) NOT NULL,
    prefijo VARCHAR(5) NOT NULL,
    secuencia_inicio BIGINT NOT NULL,
    secuencia_final BIGINT NOT NULL,
    secuencia_actual BIGINT NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(20) NOT NULL,
    fecha_creacion TIMESTAMP,
    fecha_modificacion TIMESTAMP
);
