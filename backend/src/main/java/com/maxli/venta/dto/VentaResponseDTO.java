package com.maxli.venta.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class VentaResponseDTO {

    private Long idVenta;
    private Long idTurnoCaja;
    private String cajeroNombre;
    private Long idAlmacen;
    private String almacenNombre;

    // Cliente
    private Long idCliente;
    private String clienteNombre;
    private String nombreClienteTemporal;
    private String rncTemporal;

    // Numeración
    private String numeroControl;
    private String ncf;
    private String tipoNcf;

    // Pago
    private String metodoPagoPrincipal;
    private boolean usaPrecioMayor;

    // Totales
    private BigDecimal subtotal;
    private BigDecimal descuentoTotal;
    private BigDecimal itbis;
    private BigDecimal total;
    private BigDecimal montoRecibido;
    private BigDecimal cambio;

    // Cupón
    private String codigoCupon;
    private BigDecimal descuentoCupon;

    private String estado;
    private LocalDateTime fechaVenta;

    private List<DetalleVentaResponseDTO> detalles;
    private List<IngresoVentaResponseDTO> ingresos;

    @Getter
    @Setter
    public static class DetalleVentaResponseDTO {
        private Long idDetalleVenta;
        private Long idProducto;
        private String skuProducto;
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
    }

    @Getter
    @Setter
    public static class IngresoVentaResponseDTO {
        private Long idIngresoVenta;
        private String metodoPago;
        private BigDecimal monto;
        private String referencia;
        private LocalDateTime fechaRegistro;
    }
}
