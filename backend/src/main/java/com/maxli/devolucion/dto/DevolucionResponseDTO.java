package com.maxli.devolucion.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class DevolucionResponseDTO {

    private Long idDevolucion;
    private String numeroControl;
    private String referenciaOperacion;
    private String motivo;
    private String estado;
    private String metodoReembolso;
    private LocalDateTime fechaDevolucion;

    // ── Nota de crédito y comprobante afectado ───────────────────────────
    private String ncf;
    private String tipoNcf;
    private String ncfAfectado;
    private String tipoNcfAfectado;

    // ── Venta original ───────────────────────────────────────────────────
    private Long idVenta;
    private String numeroControlVenta;
    /** Estado en que quedó la venta: PARCIALMENTE_DEVUELTA o DEVUELTA. */
    private String estadoVenta;
    private String clienteNombre;
    private String clienteRncCedula;

    // ── Operación ────────────────────────────────────────────────────────
    private Long idTurnoCaja;
    private String cajeroNombre;
    private Long idAlmacen;
    private String almacenNombre;

    // ── Totales acreditados ──────────────────────────────────────────────
    private BigDecimal baseImponible;
    private BigDecimal itbis;
    private BigDecimal total;

    private List<DetalleDevolucionResponseDTO> detalles;

    @Getter
    @Setter
    public static class DetalleDevolucionResponseDTO {
        private Long idDetalleDevolucion;
        private Long idDetalleVenta;
        private Long idProducto;
        private String skuProducto;
        private String nombreProducto;
        private Integer cantidad;
        private BigDecimal precioUnitario;
        private BigDecimal tasaItbis;
        private BigDecimal descuentoAcreditado;
        private BigDecimal importeAcreditado;
        private BigDecimal baseImponibleAcreditada;
        private BigDecimal itbisAcreditado;
    }
}
