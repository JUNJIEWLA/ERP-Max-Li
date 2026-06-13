package com.maxli.producto.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class HistorialCostoResponseDTO {

    private Long idHistorialCosto;
    private Long idProducto;
    private String nombreProducto;
    private String nombreProveedor;
    private BigDecimal costoAnterior;
    private BigDecimal costoNuevo;
    private BigDecimal variacionPorcentaje;
    private Integer cantidadRecibida;
    private LocalDateTime fechaRegistro;
}
