package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DetalleOrdenCompraResponseDTO {

    private Long idDetalleOrdenCompra;
    private Long idProducto;
    private String nombreProducto;
    private String skuProducto;
    private Integer cantidad;
    private BigDecimal precioUnitario;
    private BigDecimal subtotal;
    private Integer cantidadRecibida;

    /** cantidad - cantidadRecibida */
    private Integer cantidadPendiente;

    private Long idAlmacen;
    private String nombreAlmacen;
}
