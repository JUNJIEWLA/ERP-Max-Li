package com.maxli.venta.dto;

import java.math.BigDecimal;

/**
 * Producto más vendido del día — Top 5 del Dashboard.
 */
public record TopProductoDTO(
        Long idProducto,
        String sku,
        String nombre,
        long cantidadVendida,
        BigDecimal totalVendido
) {}
