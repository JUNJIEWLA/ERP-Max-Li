-- ═══════════════════════════════════════════════════════════════════
--  V42: Recalcular monto_esperado en turno_caja sin restar devoluciones
--
--  El efectivo físico esperado en caja es estrictamente:
--  monto_inicial + total_ventas_efectivo + total_otros_ingresos - total_egresos.
--  Las devoluciones generan Nota de Crédito y NUNCA afectan el efectivo del turno.
-- ═══════════════════════════════════════════════════════════════════

UPDATE turno_caja
SET monto_esperado = monto_inicial + total_ventas_efectivo + total_otros_ingresos - total_egresos;
