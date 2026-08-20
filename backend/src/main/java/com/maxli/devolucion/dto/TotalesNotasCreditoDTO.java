package com.maxli.devolucion.dto;

import java.math.BigDecimal;

/**
 * Totales de las Notas de Crédito B04 que revierten un conjunto de ventas.
 * <p>
 * Es lo que el reporte de ventas resta del bruto: la venta devuelta se facturó
 * de verdad —su NCF se emitió y no desaparece—, pero su importe ya no es
 * ingreso de la tienda.
 *
 * @param total     suma acreditada, con ITBIS incluido
 * @param itbis     ITBIS acreditado, para netear el ITBIS del reporte
 * @param cantidad  cuántas devoluciones confirmadas se acumularon
 */
public record TotalesNotasCreditoDTO(
        BigDecimal total,
        BigDecimal itbis,
        long cantidad
) {
}
