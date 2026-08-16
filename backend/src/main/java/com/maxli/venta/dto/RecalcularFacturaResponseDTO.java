package com.maxli.venta.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Response del recálculo dinámico. Incluye cada línea con su precio
 * recalculado y un flag que indica si hubo cambio de precio.
 */
@Getter
@Setter
public class RecalcularFacturaResponseDTO {

    private List<DetalleRecalculadoDTO> detalles = new ArrayList<>();
    private BigDecimal subtotal;
    private BigDecimal descuentoTotal;
    private BigDecimal itbis;
    private BigDecimal total;
    private boolean huboRecalculo;

    /** Cupón previsualizado (sin consumir su límite de usos — ver CuponService.previsualizarCupon). */
    private String codigoCupon;
    private BigDecimal descuentoCupon;

    @Getter
    @Setter
    public static class DetalleRecalculadoDTO {
        private Long idProducto;
        private Long idCategoria;
        private String codigoProducto;
        private String nombreProducto;
        private Integer cantidad;
        private BigDecimal precioUnitario;
        private BigDecimal precioUnitarioOriginal;
        private String tipoPrecio;
        private BigDecimal tasaItbis;
        private BigDecimal descuentoLinea;
        private BigDecimal descuentoOferta;
        private String ofertaAplicada;
        private BigDecimal importe;

        /** Suma de descuento global + cupón ya prorrateados sobre esta línea. */
        private BigDecimal descuentoProrrateado;
        private BigDecimal baseImponible;
        private BigDecimal itbisLinea;

        /** true si el precio cambió de mayor a detalle por regla de negocio. */
        private boolean recalculado;

        /** Mensaje descriptivo del cambio para la alerta visual del frontend. */
        private String mensajeRecalculo;
    }
}
