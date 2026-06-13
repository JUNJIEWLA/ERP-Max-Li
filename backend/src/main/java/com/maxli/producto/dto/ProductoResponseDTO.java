package com.maxli.producto.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class ProductoResponseDTO {

    private Long idProducto;
    private String sku;
    private String codigoBarras;
    private String nombre;
    private String descripcion;
    private BigDecimal precioVenta;
    private BigDecimal costo;
    private String estado;
    private Long idCategoria;
    private String categoriaNombre;
    private BigDecimal porcentajeMargenCategoria;
    private Long idMarca;
    private String marcaNombre;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
