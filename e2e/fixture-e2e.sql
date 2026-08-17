-- ═══════════════════════════════════════════════════════════════════
--  Fixture del E2E del flujo principal (Task 5)
--
--  Se aplica SIEMPRE después de las migraciones Flyway reales y NUNCA
--  forma parte de ellas: son datos de prueba, no esquema ni datos de
--  producción.
--
--  Deja la base en un estado determinista y repetible:
--    · un almacén activo y una única caja activa asociada a él;
--    · una categoría y una marca;
--    · un producto activo con SKU estable, RD$118.00 (base 100 + 18 %
--      de ITBIS) y 10 unidades de existencia en ese almacén;
--    · una resolución NCF B02 activa, vigente y con secuencia libre;
--    · una resolución NCF B04 (nota de crédito) en las mismas
--      condiciones, para que la devolución pueda emitir su comprobante.
--
--  Ningún id se escribe a mano: todo se resuelve por subconsulta sobre
--  los nombres/SKU del fixture.
-- ═══════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── Guarda: solo la base E2E ────────────────────────────────────────
--  El fixture borra ventas y turnos. Aplicado por error sobre la base
--  del piloto destruiría datos reales, así que aborta antes de tocar
--  nada si el nombre no es exactamente `maxli_e2e`.
DO $$
BEGIN
    IF current_database() <> 'maxli_e2e' THEN
        RAISE EXCEPTION
            'Fixture E2E abortado: la base conectada es "%". Solo puede aplicarse sobre maxli_e2e.',
            current_database();
    END IF;
END $$;

BEGIN;

-- ── 1. Limpieza de lo transaccional ─────────────────────────────────
--  Permite repetir el E2E sobre la misma base: cada ejecución arranca
--  sin ventas, sin movimientos y sin ningún turno abierto.
--  Las devoluciones van primero: apuntan a venta y a detalle_venta, así
--  que borrar la venta antes chocaría contra sus FK.
DELETE FROM detalle_devolucion;
DELETE FROM devolucion;
DELETE FROM ingreso_venta;
DELETE FROM detalle_venta;
DELETE FROM venta;
DELETE FROM detalle_movimiento;
DELETE FROM movimiento;
DELETE FROM movimiento_caja;
DELETE FROM turno_caja;

-- ── 2. Almacén ──────────────────────────────────────────────────────
INSERT INTO almacen (nombre, descripcion, estado, fecha_creacion)
VALUES ('Almacén E2E', 'Almacén exclusivo del E2E del flujo principal', 'ACTIVO', NOW())
ON CONFLICT (nombre) DO UPDATE
    SET estado = 'ACTIVO',
        fecha_modificacion = NOW();

-- ── 3. Caja registradora ────────────────────────────────────────────
--  `caja` no tiene unicidad por nombre, así que el upsert es explícito.
UPDATE caja
SET estado = 'ACTIVO',
    id_almacen = (SELECT id_almacen FROM almacen WHERE nombre = 'Almacén E2E'),
    fecha_modificacion = NOW()
WHERE nombre = 'Caja E2E';

INSERT INTO caja (nombre, estado, id_almacen, fecha_creacion)
SELECT 'Caja E2E', 'ACTIVO',
       (SELECT id_almacen FROM almacen WHERE nombre = 'Almacén E2E'),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM caja WHERE nombre = 'Caja E2E');

-- Cualquier otra caja queda fuera de juego: el selector de apertura debe
-- ofrecer una sola opción activa y no depender del orden de listado.
UPDATE caja
SET estado = 'INACTIVO',
    fecha_modificacion = NOW()
WHERE nombre <> 'Caja E2E'
  AND estado = 'ACTIVO';

-- ── 4. Categoría y marca ────────────────────────────────────────────
INSERT INTO categoria (nombre, descripcion, estado, fecha_creacion)
VALUES ('Categoría E2E', 'Categoría del producto de prueba', 'ACTIVO', NOW())
ON CONFLICT (nombre) DO UPDATE
    SET estado = 'ACTIVO',
        fecha_modificacion = NOW();

INSERT INTO marca (nombre, descripcion, estado, fecha_creacion)
VALUES ('Marca E2E', 'Marca del producto de prueba', 'ACTIVO', NOW())
ON CONFLICT (nombre) DO UPDATE
    SET estado = 'ACTIVO',
        fecha_modificacion = NOW();

-- ── 5. Producto ─────────────────────────────────────────────────────
--  RD$118.00 con ITBIS incluido al 18 %: base RD$100.00 + RD$18.00.
INSERT INTO producto (
    sku, nombre, descripcion, precio_venta, precio_venta_mayor, costo,
    tasa_itbis, cantidad_minima_mayor, estado, id_categoria, id_marca, fecha_creacion
)
VALUES (
    'E2E-PROD-001',
    'Producto E2E Flujo Principal',
    'Producto determinista del E2E: RD$118.00 con ITBIS incluido.',
    118.00, 118.00, 60.00,
    18.00, 1, 'ACTIVO',
    (SELECT id_categoria FROM categoria WHERE nombre = 'Categoría E2E'),
    (SELECT id_marca FROM marca WHERE nombre = 'Marca E2E'),
    NOW()
)
ON CONFLICT (sku) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        precio_venta = EXCLUDED.precio_venta,
        precio_venta_mayor = EXCLUDED.precio_venta_mayor,
        costo = EXCLUDED.costo,
        tasa_itbis = EXCLUDED.tasa_itbis,
        cantidad_minima_mayor = EXCLUDED.cantidad_minima_mayor,
        estado = 'ACTIVO',
        id_categoria = EXCLUDED.id_categoria,
        id_marca = EXCLUDED.id_marca,
        fecha_modificacion = NOW();

-- ── 6. Existencia ───────────────────────────────────────────────────
INSERT INTO existencia (id_producto, id_almacen, cantidad_actual, cantidad_minima, fecha_creacion)
VALUES (
    (SELECT id_producto FROM producto WHERE sku = 'E2E-PROD-001'),
    (SELECT id_almacen FROM almacen WHERE nombre = 'Almacén E2E'),
    10, 1, NOW()
)
ON CONFLICT (id_producto, id_almacen) DO UPDATE
    SET cantidad_actual = 10,
        cantidad_minima = 1,
        fecha_modificacion = NOW();

-- ── 7. Resoluciones NCF: B02 de venta y B04 de nota de crédito ──────
--  Un índice único parcial impide dos resoluciones ACTIVO del mismo
--  tipo: se reemplazan en lugar de acumular otra.
--  El B04 es lo que permite que una devolución emita su comprobante:
--  sin resolución vigente el servicio revierte la operación completa.
DELETE FROM resolucion_ncf WHERE tipo_ncf IN ('B02', 'B04');

INSERT INTO resolucion_ncf (
    tipo_ncf, descripcion, numero_resolucion, prefijo,
    secuencia_inicio, secuencia_final, secuencia_actual,
    fecha_vencimiento, estado, fecha_creacion
)
VALUES
    ('B02', 'Consumidor Final (E2E)', 'E2E-B02-001', 'B02',
     1, 10000, 1,
     CURRENT_DATE + INTERVAL '365 days', 'ACTIVO', NOW()),
    ('B04', 'Nota de Crédito (E2E)', 'E2E-B04-001', 'B04',
     1, 10000, 1,
     CURRENT_DATE + INTERVAL '365 days', 'ACTIVO', NOW());

COMMIT;

-- ── Resumen para el log de CI ───────────────────────────────────────
SELECT 'caja'      AS entidad, nombre AS detalle, estado FROM caja      WHERE nombre = 'Caja E2E'
UNION ALL
SELECT 'almacen',  nombre, estado FROM almacen  WHERE nombre = 'Almacén E2E'
UNION ALL
SELECT 'producto', sku || ' @ RD$' || precio_venta, estado FROM producto WHERE sku = 'E2E-PROD-001'
UNION ALL
SELECT 'existencia', 'stock=' || cantidad_actual, 'ACTIVO'
  FROM existencia e JOIN producto p ON p.id_producto = e.id_producto
 WHERE p.sku = 'E2E-PROD-001'
UNION ALL
SELECT 'ncf', prefijo || ' desde ' || secuencia_actual || ' hasta ' || secuencia_final, estado
  FROM resolucion_ncf WHERE tipo_ncf IN ('B02', 'B04');
