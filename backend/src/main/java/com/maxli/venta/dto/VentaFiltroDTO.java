package com.maxli.venta.dto;

import java.time.LocalDate;

/**
 * Filtros del Historial de Ventas, tal como llegan por query string.
 * <p>
 * Un filtro en blanco es un filtro ausente: el formulario manda cadenas vacías
 * cuando el usuario borra un campo, y eso no debe recortar el listado.
 *
 * @param q           número de control, NCF o nombre de cliente (búsqueda parcial)
 * @param fechaDesde  primer día incluido
 * @param fechaHasta  último día incluido, completo hasta las 23:59:59
 * @param cajero      username exacto del usuario que cobró
 * @param metodoPago  nombre de {@link com.maxli.venta.entity.MetodoPago}
 * @param estado      estado de la venta (COMPLETADA, ANULADA, …)
 */
public record VentaFiltroDTO(
        String q,
        LocalDate fechaDesde,
        LocalDate fechaHasta,
        String cajero,
        String metodoPago,
        String estado
) {
}
