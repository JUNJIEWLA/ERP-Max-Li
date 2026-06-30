package com.maxli.oferta.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class OfertaResponseDTO {

    private Long idOferta;
    private String nombre;
    private String descripcion;
    private String tipo;
    private Long idProducto;
    private String productoSku;
    private String productoNombre;
    private LocalDate fechaInicio;
    private LocalDate fechaFin;
    private String estado;
    private Integer cantidadRequerida;
    private Integer cantidadPagada;
    private BigDecimal porcentajeDescuento;
    private boolean vigente;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
