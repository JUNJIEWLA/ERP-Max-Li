-- ═══════════════════════════════════════════════════════════════════
--  V27: Tabla de Empaques (unidades de medida/presentación del POS)
--  Permite configurar las presentaciones de venta: Unidad, Docena, Caja, Fardo, etc.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE empaque (
    id_empaque        BIGSERIAL      PRIMARY KEY,
    nombre            VARCHAR(80)    NOT NULL,
    cantidad          INTEGER        NOT NULL DEFAULT 1,
    descripcion       VARCHAR(255),
    estado            VARCHAR(20)    NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion    TIMESTAMP,
    fecha_modificacion TIMESTAMP,
    CONSTRAINT uk_empaque_nombre  UNIQUE (nombre),
    CONSTRAINT chk_empaque_cantidad CHECK (cantidad >= 1),
    CONSTRAINT chk_empaque_estado  CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

-- ── Seed: Empaques comunes ─────────────────────────────────────────
INSERT INTO empaque (nombre, cantidad, descripcion) VALUES
    ('Unidad',       1,  'Pieza individual'),
    ('Par',          2,  '2 unidades'),
    ('Media Docena', 6,  '6 unidades'),
    ('Docena',       12, '12 unidades'),
    ('Fardo',        24, '24 unidades'),
    ('Caja x 48',    48, '48 unidades'),
    ('Gruesa',       144,'144 unidades (12 docenas)');
