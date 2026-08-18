package com.maxli.venta.dto;

import java.math.BigDecimal;

/**
 * Ventas totalizadas por día — para la gráfica de líneas del Dashboard.
 */
public record VentaDiariaDTO(
        String fecha,        // "2026-08-18"
        BigDecimal total,
        long transacciones
) {}
