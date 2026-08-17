-- ═══════════════════════════════════════════════════════════════════
--  V43: NOTA_CREDITO como método de reembolso de una devolución
--
--  V36 creó `chk_devolucion_metodo` con el dominio de entonces —efectivo,
--  tarjeta, transferencia y cheque— porque la tienda devolvía dinero. La
--  política vigente (V38, impresa al pie de cada comprobante) ya no lo hace:
--  toda devolución se acredita como Nota de Crédito B04.
--
--  El servicio pasó a escribir 'NOTA_CREDITO' sin que este CHECK lo admitiera,
--  de modo que **ninguna devolución podía registrarse**: PostgreSQL rechazaba
--  el INSERT y la API respondía 422. Esta migración cierra ese hueco.
--
--  El dominio se amplía en vez de reemplazarse: las devoluciones ya emitidas
--  bajo la política anterior conservan el método con el que realmente se
--  reembolsaron, y un CHECK que las invalidara haría fallar la migración sobre
--  cualquier base con historial. Que hoy solo se emita Nota de Crédito lo
--  impone `DevolucionService`, que es donde vive la política; la base custodia
--  el dominio de valores, no la regla de negocio del día.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE devolucion
    DROP CONSTRAINT IF EXISTS chk_devolucion_metodo;

ALTER TABLE devolucion
    ADD CONSTRAINT chk_devolucion_metodo CHECK (metodo_reembolso IN
        ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'NOTA_CREDITO'));

COMMENT ON COLUMN devolucion.metodo_reembolso
    IS 'Destino del crédito. Las devoluciones nuevas siempre son NOTA_CREDITO; '
       'los demás valores solo aparecen en el historial anterior a esa política.';

-- Una Nota de Crédito nace con su saldo íntegro disponible. Las devoluciones
-- históricas reembolsadas en dinero NO lo tienen: ese importe ya salió por
-- caja, y dejarlo como saldo redimible permitiría cobrarlo dos veces.
UPDATE devolucion
SET monto_disponible = 0.00
WHERE metodo_reembolso <> 'NOTA_CREDITO'
  AND monto_usado = 0.00
  AND monto_disponible <> 0.00;
