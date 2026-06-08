package com.maxli.inventario.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DetalleMovimientoResponseDTO {

    private Long idDetalleMovimiento;
    private Long idProducto;
    private String productoNombre;
    private String productoSku;
    private Integer cantidad;
}
