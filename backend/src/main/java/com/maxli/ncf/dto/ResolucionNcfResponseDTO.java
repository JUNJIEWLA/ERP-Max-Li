package com.maxli.ncf.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ResolucionNcfResponseDTO {
    private Long idResolucion;
    private String tipoNcf;
    private String descripcion;
    private String numeroResolucion;
    private String prefijo;
    private Long secuenciaInicio;
    private Long secuenciaFinal;
    private Long secuenciaActual;
    private LocalDate fechaVencimiento;
    private String estado;
    private LocalDateTime fechaCreacion;
}
