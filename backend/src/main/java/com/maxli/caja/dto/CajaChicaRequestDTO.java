package com.maxli.caja.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CajaChicaRequestDTO {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String nombre;

    @NotBlank(message = "El responsable es obligatorio")
    @Size(max = 100, message = "El responsable no puede superar 100 caracteres")
    private String responsable;

    @NotNull(message = "El saldo actual es obligatorio")
    @DecimalMin(value = "0.00", message = "El saldo actual no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El saldo actual debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal saldoActual;

    @NotNull(message = "El limite es obligatorio")
    @DecimalMin(value = "0.01", message = "El limite debe ser mayor a cero")
    @Digits(integer = 10, fraction = 2, message = "El limite debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal limiteMonto;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";
}
