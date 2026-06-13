package com.maxli.producto.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class CategoriaResponseDTO {

    private Long idCategoria;
    private String nombre;
    private String descripcion;
    private String estado;
    private BigDecimal porcentajeMargen;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
