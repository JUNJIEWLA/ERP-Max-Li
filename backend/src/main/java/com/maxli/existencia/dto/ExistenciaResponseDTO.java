package com.maxli.existencia.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ExistenciaResponseDTO {

    private Long idExistencia;
    private Long idProducto;
    private String productoCodigo;
    private String productoNombre;
    private String productoEstado;
    private Integer cantidadActual;
    private Integer cantidadMinima;
    private boolean bajoPuntoReorden;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
