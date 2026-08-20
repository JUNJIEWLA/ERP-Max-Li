package com.maxli.venta.dto;

import java.math.BigDecimal;

/**
 * Totales brutos de un conjunto de ventas, sumados por la base.
 * <p>
 * Se agregan en SQL y no recorriendo la página en memoria: el reporte lista
 * como máximo 10.000 filas, pero el total tiene que salir de <b>todas</b> las
 * ventas del rango, no solo de las que se alcanzaron a paginar.
 *
 * @param total          suma de {@code venta.total}, tal como se facturó
 * @param itbis          suma de {@code venta.itbis}
 * @param descuentos     descuentos aplicados: los de la venta más los de cupón
 * @param transacciones  cuántas ventas entran en el rango
 */
public record TotalesVentasDTO(
        BigDecimal total,
        BigDecimal itbis,
        BigDecimal descuentos,
        long transacciones
) {
}
