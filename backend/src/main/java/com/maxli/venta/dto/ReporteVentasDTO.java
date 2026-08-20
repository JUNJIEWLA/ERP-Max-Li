package com.maxli.venta.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Respuesta del reporte de ventas: las filas y los totales que las cuadran.
 * <p>
 * Los totales vienen en tres bloques encadenados para que cada cifra se pueda
 * verificar contra la tabla, sin pedirle al lector que confíe:
 *
 * <pre>
 *   ventas brutas        ← suma de la columna Total de la tabla
 *   − notas de crédito   ← lo que las devoluciones B04 acreditaron
 *   = ventas netas       ← {@code totalVentas}
 * </pre>
 *
 * La venta devuelta sigue apareciendo en {@code ventas}: su NCF se emitió y
 * borrarla del listado sería esconder un comprobante fiscal. Lo que cambia es
 * que ya no cuenta como ingreso.
 *
 * @param ventas                  filas del período, incluidas las devueltas
 * @param totalVentas             <b>neto</b>: bruto menos las notas de crédito
 * @param totalItbis              <b>neto</b>: ITBIS facturado menos el acreditado
 * @param totalDescuentos         descuentos concedidos, de venta y de cupón
 * @param totalTransacciones      cuántas ventas entran en el período
 * @param totalVentasBrutas       suma tal como se facturó, sin descontar nada
 * @param totalItbisBrutos        ITBIS tal como se facturó
 * @param totalNotasCredito       acreditado por devoluciones de esas ventas
 * @param totalItbisNotasCredito  ITBIS contenido en lo acreditado
 * @param totalDevoluciones       cuántas notas de crédito se restaron
 */
public record ReporteVentasDTO(
        List<VentaResumenDTO> ventas,
        BigDecimal totalVentas,
        BigDecimal totalItbis,
        BigDecimal totalDescuentos,
        long totalTransacciones,
        BigDecimal totalVentasBrutas,
        BigDecimal totalItbisBrutos,
        BigDecimal totalNotasCredito,
        BigDecimal totalItbisNotasCredito,
        long totalDevoluciones
) {}
