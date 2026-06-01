package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DetalleNotaRecepcionResponseDTO {

    private Long idDetalleNotaRecepcion;
    private Long idDetalleOrdenCompra;
    private Long idProducto;
    private String nombreProducto;
    private Integer cantidadSolicitada;
    private Integer cantidadRecibida;
    private String observacion;
    private String notas;
}
