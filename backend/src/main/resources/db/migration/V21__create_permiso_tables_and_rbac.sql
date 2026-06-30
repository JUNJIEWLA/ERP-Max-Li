-- ═══════════════════════════════════════════════════════════════════
--  V21: Sistema de Permisos Granulares (RBAC) y mejoras de seguridad
--
--  Crea las tablas permiso, rol_permiso, usuario_permiso.
--  Agrega requiere_cambio_password y token_version a usuario.
--  Agrega estado SUSPENDIDO.
--  Seed de permisos y asignación por defecto a roles.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabla de permisos ──────────────────────────────────────────
CREATE TABLE permiso (
    id_permiso   BIGSERIAL    PRIMARY KEY,
    nombre_clave VARCHAR(80)  NOT NULL,
    descripcion  VARCHAR(255),
    modulo       VARCHAR(50)  NOT NULL,
    CONSTRAINT uk_permiso_nombre_clave UNIQUE (nombre_clave)
);

CREATE INDEX idx_permiso_modulo ON permiso (modulo);

-- ── 2. Tabla intermedia rol_permiso ───────────────────────────────
CREATE TABLE rol_permiso (
    id_rol     BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT fk_rol_permiso_rol     FOREIGN KEY (id_rol)     REFERENCES rol     (id_rol)     ON DELETE CASCADE,
    CONSTRAINT fk_rol_permiso_permiso FOREIGN KEY (id_permiso) REFERENCES permiso (id_permiso) ON DELETE CASCADE
);

-- ── 3. Tabla intermedia usuario_permiso (permisos por excepción) ──
CREATE TABLE usuario_permiso (
    id_usuario BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    PRIMARY KEY (id_usuario, id_permiso),
    CONSTRAINT fk_usuario_permiso_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_usuario_permiso_permiso FOREIGN KEY (id_permiso) REFERENCES permiso (id_permiso) ON DELETE CASCADE
);

-- ── 4. Agregar columnas de seguridad a usuario ───────────────────
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS creado_por BIGINT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS modificado_por BIGINT;

-- Admin existente no necesita cambiar su password
UPDATE usuario SET requiere_cambio_password = false WHERE username = 'admin';

-- ── 5. Ampliar CHECK de estado para incluir SUSPENDIDO ────────────
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_estado;
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_estado
    CHECK (estado IN ('ACTIVO', 'INACTIVO', 'SUSPENDIDO'));

-- ── 6. Seed de permisos del sistema ──────────────────────────────
INSERT INTO permiso (nombre_clave, descripcion, modulo) VALUES
    -- Seguridad
    ('USUARIO_GESTIONAR',    'Crear, editar y desactivar usuarios del sistema',               'Seguridad'),
    ('ROL_GESTIONAR',        'Crear, editar roles y asignar permisos',                        'Seguridad'),
    -- Catálogo
    ('PRODUCTO_VER',         'Ver catálogo de productos, categorías y marcas',                 'Catálogo'),
    ('PRODUCTO_GESTIONAR',   'Crear, editar y desactivar productos, categorías y marcas',     'Catálogo'),
    -- Inventario
    ('INVENTARIO_VER',       'Ver existencias y movimientos de inventario',                    'Inventario'),
    ('INVENTARIO_GESTIONAR', 'Ajustar stock, crear transferencias y conteos físicos',          'Inventario'),
    -- Ventas
    ('VENTA_CREAR',          'Crear ventas desde el Punto de Venta',                           'Ventas'),
    ('VENTA_VER',            'Ver historial de ventas y detalles',                             'Ventas'),
    ('VENTA_ANULAR',         'Anular ventas registradas',                                      'Ventas'),
    -- Caja
    ('CAJA_OPERAR',          'Abrir y cerrar turnos de caja',                                  'Caja'),
    ('CAJA_GESTIONAR',       'Gestionar cajas registradoras y caja chica',                     'Caja'),
    -- Compras
    ('COMPRA_GESTIONAR',     'Crear órdenes de compra, notas de recepción y pagos',            'Compras'),
    ('PROVEEDOR_GESTIONAR',  'Crear, editar y desactivar proveedores',                         'Compras'),
    -- Devoluciones
    ('DEVOLUCION_CREAR',     'Crear devoluciones y notas de crédito',                          'Devoluciones'),
    -- Clientes
    ('CLIENTE_GESTIONAR',    'Crear, editar y gestionar perfiles de clientes',                 'Clientes'),
    -- Reportes
    ('REPORTE_VER',          'Ver reportes, dashboard y estadísticas',                         'Reportes'),
    -- Configuración
    ('CONFIGURACION_VER',    'Acceso a la sección de configuración del sistema',               'Configuración'),
    -- Nómina
    ('NOMINA_GESTIONAR',     'Gestionar pagos, horas y registros de personal',                 'Nómina'),
    -- Contabilidad
    ('CONTABILIDAD_VER',     'Ver reportes financieros, impuestos y auditoría (solo lectura)', 'Contabilidad');

-- ── 7. Asignar permisos por defecto a roles existentes ───────────

-- ADMIN: todos los permisos
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r, permiso p
WHERE r.nombre = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);

-- SUPERVISOR: gestión operativa sin seguridad ni configuración
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r, permiso p
WHERE r.nombre = 'SUPERVISOR'
  AND p.nombre_clave IN (
      'PRODUCTO_VER', 'PRODUCTO_GESTIONAR',
      'INVENTARIO_VER', 'INVENTARIO_GESTIONAR',
      'VENTA_CREAR', 'VENTA_VER', 'VENTA_ANULAR',
      'CAJA_OPERAR',
      'COMPRA_GESTIONAR', 'PROVEEDOR_GESTIONAR',
      'DEVOLUCION_CREAR',
      'CLIENTE_GESTIONAR',
      'REPORTE_VER'
  )
  AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);

-- CAJERO: punto de venta, caja, ver inventario
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r, permiso p
WHERE r.nombre = 'CAJERO'
  AND p.nombre_clave IN (
      'PRODUCTO_VER',
      'INVENTARIO_VER',
      'VENTA_CREAR', 'VENTA_VER',
      'CAJA_OPERAR',
      'CLIENTE_GESTIONAR'
  )
  AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);

-- AUXILIAR_INVENTARIO: solo lectura de catálogo
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r, permiso p
WHERE r.nombre = 'AUXILIAR_INVENTARIO'
  AND p.nombre_clave IN (
      'PRODUCTO_VER',
      'INVENTARIO_VER'
  )
  AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);
