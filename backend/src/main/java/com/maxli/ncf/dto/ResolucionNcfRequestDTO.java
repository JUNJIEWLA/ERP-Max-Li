package com.maxli.ncf.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ResolucionNcfRequestDTO {

    @NotBlank(message = "El tipo de NCF es requerido")
    @Size(max = 10)
    private String tipoNcf;

    @NotBlank(message = "La descripción es requerida")
    @Size(max = 100)
    private String descripcion;

    @NotBlank(message = "El número de resolución es requerido")
    @Size(max = 50)
    private String numeroResolucion;

    @NotBlank(message = "El prefijo es requerido")
    @Size(max = 5)
    private String prefijo;

    @NotNull(message = "La secuencia de inicio es requerida")
    private Long secuenciaInicio;

    @NotNull(message = "La secuencia final es requerida")
    private Long secuenciaFinal;

    @NotNull(message = "La fecha de vencimiento es requerida")
    private LocalDate fechaVencimiento;
}
