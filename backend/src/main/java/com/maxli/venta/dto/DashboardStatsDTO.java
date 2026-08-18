package com.maxli.venta.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Estadísticas consolidadas del Dashboard.
 * Un solo objeto que el frontend consume en una sola llamada.
 */
public record DashboardStatsDTO(
        // KPIs principales
        BigDecimal ventasHoy,
        BigDecimal ventasAyer,
        long totalTransaccionesHoy,
        long totalTransaccionesAyer,
        long productosActivos,
        long productosBajoStock,
        BigDecimal itbisHoy,

        // Ventas últimos 7 días (gráfica de líneas)
        List<VentaDiariaDTO> ventasUltimos7Dias,

        // Ventas por método de pago (gráfica de pastel)
        List<MetodoPagoStatsDTO> ventasPorMetodoPago,

        // Top 5 productos más vendidos hoy
        List<TopProductoDTO> topProductos,

        // Últimas 10 ventas
        List<UltimaVentaDTO> ultimasVentas
) {}
