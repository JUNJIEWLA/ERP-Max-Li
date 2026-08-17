package com.maxli.venta.dto;

import com.maxli.venta.entity.MetodoPago;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Una fila del Historial de Ventas.
 * <p>
 * El listado no arrastra líneas ni ingresos: una página de 20 ventas con sus
 * detalles son cientos de filas que la tabla no muestra. El detalle completo
 * se pide aparte con {@code GET /api/ventas/{id}}.
 *
 * @param clienteNombre nombre del cliente registrado o, si la venta fue a un
 *                      cliente de paso, el nombre temporal que se capturó.
 *                      {@code null} cuando la venta no identificó a nadie.
 */
public record VentaResumenDTO(
        Long idVenta,
        String numeroControl,
        LocalDateTime fechaVenta,
        String ncf,
        String tipoNcf,
        String clienteNombre,
        String cajeroNombre,
        MetodoPago metodoPagoPrincipal,
        BigDecimal total,
        String estado
) {
}
