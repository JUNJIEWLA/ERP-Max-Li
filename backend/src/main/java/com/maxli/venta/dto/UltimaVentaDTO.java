package com.maxli.venta.dto;

import java.math.BigDecimal;

/**
 * Resumen ligero de una venta reciente — últimas 10 ventas del Dashboard.
 */
public record UltimaVentaDTO(
        Long idVenta,
        String numeroControl,
        String clienteNombre,
        String cajeroNombre,
        String metodoPago,
        BigDecimal total,
        String fechaVenta     // ISO 8601
) {}
