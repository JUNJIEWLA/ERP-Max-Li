-- ═══════════════════════════════════════════════════════════════════
--  V8: Roles completos + Usuario Administrador inicial
--  Contraseña del admin: Admin@2026
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Agregar el rol AUXILIAR_INVENTARIO (faltaba en V4) ──────────
INSERT INTO rol (nombre)
SELECT 'AUXILIAR_INVENTARIO'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'AUXILIAR_INVENTARIO');

-- ── 2. Asegurar que todos los roles base existen ───────────────────
INSERT INTO rol (nombre)
SELECT 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'ADMIN');

INSERT INTO rol (nombre)
SELECT 'CAJERO'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'CAJERO');

INSERT INTO rol (nombre)
SELECT 'SUPERVISOR'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'SUPERVISOR');

-- ── 3. Agregar columna de descripcion a la tabla rol ──────────────
ALTER TABLE rol ADD COLUMN IF NOT EXISTS descripcion VARCHAR(255);

-- ── 4. Establecer descripciones de los roles ──────────────────────
UPDATE rol SET descripcion = 'Control total del sistema. Gestión de usuarios, configuración, reportes financieros y eliminación de registros.'
WHERE nombre = 'ADMIN';

UPDATE rol SET descripcion = 'Atención al cliente y punto de venta. Crear facturas, procesar pagos y cuadre de caja. Sin acceso a costos ni reportes financieros.'
WHERE nombre = 'CAJERO';

UPDATE rol SET descripcion = 'Manejo operativo diario. Puede autorizar devoluciones, aplicar descuentos especiales y ver reportes de ventas del día.'
WHERE nombre = 'SUPERVISOR';

UPDATE rol SET descripcion = 'Etiquetado, organización física y conteo de productos. Solo lectura del catálogo y generación de etiquetas/códigos de barras.'
WHERE nombre = 'AUXILIAR_INVENTARIO';

-- ── 5. Crear usuario Administrador inicial ─────────────────────────
--   Usuario  : admin
--   Email    : admin@maxli.com
--   Contraseña: Admin@2026
--   Hash BCrypt (cost=10): generado con Python bcrypt
INSERT INTO usuario (username, email, password_hash, estado)
SELECT 'admin', 'admin@maxli.com',
       '$2a$10$oqR3egEbQrfRrMPrvtdIueqhTImOq5Ix/U67c2rP3TzOFrcO2MvJ2',
       'ACTIVO'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE username = 'admin');

-- ── 6. Asignar rol ADMIN al usuario admin ─────────────────────────
INSERT INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol
FROM usuario u, rol r
WHERE u.username = 'admin'
  AND r.nombre = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM usuario_rol ur
      WHERE ur.id_usuario = u.id_usuario AND ur.id_rol = r.id_rol
  );
