package com.maxli.producto.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CategoriaRequestDTO {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String nombre;

    @Size(max = 255, message = "La descripcion no puede superar 255 caracteres")
    private String descripcion;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";

    @DecimalMin(value = "0.00", message = "El margen no puede ser negativo")
    @DecimalMax(value = "999.99", message = "El margen no puede superar 999.99%")
    private BigDecimal porcentajeMargen = BigDecimal.ZERO;
}
