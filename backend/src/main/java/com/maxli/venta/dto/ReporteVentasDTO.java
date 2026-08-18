package com.maxli.venta.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Respuesta del reporte de ventas: incluye las ventas y los totales.
 */
public record ReporteVentasDTO(
        List<VentaResumenDTO> ventas,
        BigDecimal totalVentas,
        BigDecimal totalItbis,
        BigDecimal totalDescuentos,
        long totalTransacciones
) {}
