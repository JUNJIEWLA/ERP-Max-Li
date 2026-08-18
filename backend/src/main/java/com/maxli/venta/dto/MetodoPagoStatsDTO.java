package com.maxli.venta.dto;

import java.math.BigDecimal;

/**
 * Distribución de ventas por método de pago — para la gráfica de pastel.
 */
public record MetodoPagoStatsDTO(
        String metodoPago,
        BigDecimal total,
        long transacciones
) {}
