package com.maxli.devolucion.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Lo que todavía se puede devolver de una venta: por cada línea, cuánto se
 * vendió, cuánto se devolvió ya y cuánto queda disponible.
 */
@Getter
@Setter
public class VentaDevolubleResponseDTO {

    private Long idVenta;
    private String numeroControl;
    private String ncf;
    private String tipoNcf;
    private String estado;
    private LocalDateTime fechaVenta;
    private Long idAlmacen;
    private String almacenNombre;
    private String clienteNombre;
    /** false cuando la venta ya no admite devoluciones (estado o datos fiscales). */
    private boolean devolvible;

    private List<LineaDevolubleDTO> lineas;

    @Getter
    @Setter
    public static class LineaDevolubleDTO {
        private Long idDetalleVenta;
        private Long idProducto;
        private String skuProducto;
        private String nombreProducto;
        private Integer cantidadVendida;
        private Integer cantidadDevuelta;
        private Integer cantidadDisponible;
        private BigDecimal precioUnitario;
        private BigDecimal tasaItbis;
        private BigDecimal importe;
    }
}
