package com.maxli.producto.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class AlertaCostoResponseDTO {

    private Long idAlertaCosto;
    private Long idProducto;
    private String nombreProducto;
    private BigDecimal costoAnterior;
    private BigDecimal costoNuevo;
    private BigDecimal precioVentaActual;
    private BigDecimal precioVentaSugerido;
    private BigDecimal porcentajeVariacion;
    private BigDecimal porcentajeMargen;
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaResolucion;
}
