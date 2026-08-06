package com.maxli.empaque.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class EmpaqueResponseDTO {
    private Long idEmpaque;
    private String nombre;
    private Integer cantidad;
    private String descripcion;
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
