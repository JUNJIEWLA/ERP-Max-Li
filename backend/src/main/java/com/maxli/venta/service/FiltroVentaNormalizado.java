package com.maxli.venta.service;

import com.maxli.exception.ParametroInvalidoException;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.entity.MetodoPago;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Los filtros del Historial de Ventas, ya traducidos a lo que espera la base.
 * <p>
 * Existe para que el listado y los totales del reporte se construyan con
 * <b>exactamente</b> los mismos criterios. Cuando la normalización estaba
 * duplicada, bastaba con que una copia interpretara el día final o una cadena
 * en blanco distinto de la otra para que el reporte listara unas ventas y
 * sumara otras.
 *
 * @param q           patrón de búsqueda ya en minúsculas y entre {@code %}, o nulo
 * @param desde       instante inicial, o nulo si no se acotó
 * @param hasta       instante final del día indicado, o nulo si no se acotó
 * @param cajero      username exacto en minúsculas, o nulo
 * @param metodoPago  método de pago ya validado, o nulo
 */
public record FiltroVentaNormalizado(
        String q,
        LocalDateTime desde,
        LocalDateTime hasta,
        String cajero,
        MetodoPago metodoPago
) {

    public static FiltroVentaNormalizado de(VentaFiltroDTO filtro) {
        LocalDateTime desde = filtro.fechaDesde() != null ? filtro.fechaDesde().atStartOfDay() : null;
        // El día de `fechaHasta` cuenta entero: una venta de las 23:45 sigue
        // perteneciendo a esa fecha.
        LocalDateTime hasta = filtro.fechaHasta() != null ? filtro.fechaHasta().atTime(LocalTime.MAX) : null;

        if (desde != null && hasta != null && desde.isAfter(hasta)) {
            throw new ParametroInvalidoException(
                    "El rango de fechas es inválido: fechaDesde no puede ser posterior a fechaHasta.");
        }

        String q = limpiar(filtro.q());
        String cajero = limpiar(filtro.cajero());

        return new FiltroVentaNormalizado(
                q != null ? "%" + q.toLowerCase() + "%" : null,
                desde,
                hasta,
                cajero != null ? cajero.toLowerCase() : null,
                parsearMetodoPago(filtro.metodoPago()));
    }

    /** Un filtro en blanco es un filtro ausente. */
    private static String limpiar(String valor) {
        if (valor == null) return null;
        String texto = valor.trim();
        return texto.isEmpty() ? null : texto;
    }

    private static MetodoPago parsearMetodoPago(String valor) {
        String texto = limpiar(valor);
        if (texto == null) return null;
        try {
            return MetodoPago.valueOf(texto.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ParametroInvalidoException("Método de pago desconocido: " + texto);
        }
    }
}
