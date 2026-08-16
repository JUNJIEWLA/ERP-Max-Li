-- ═══════════════════════════════════════════════════════════════════
--  V29: Permisos faltantes para completar la matriz de autorización
--  del backend (ISSUE-011). Solo se asignan a ADMIN: ningún rol
--  amplía su acceso actual, se cierran huecos que hoy caían en
--  anyRequest().authenticated().
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO permiso (nombre_clave, descripcion, modulo) VALUES
    ('NCF_GESTIONAR',    'Crear, editar y consumir directamente resoluciones y secuencias NCF', 'Fiscal'),
    ('CUPON_GESTIONAR',  'Crear, editar y desactivar cupones de descuento',                      'Ventas'),
    ('ALMACEN_GESTIONAR','Crear, editar y desactivar almacenes',                                 'Inventario');

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r, permiso p
WHERE r.nombre = 'ADMIN'
  AND p.nombre_clave IN ('NCF_GESTIONAR', 'CUPON_GESTIONAR', 'ALMACEN_GESTIONAR')
  AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);
