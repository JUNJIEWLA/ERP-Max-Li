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
public class MovimientoCajaRequestDTO {

    @NotBlank(message = "El tipo de movimiento es obligatorio")
    @Pattern(regexp = "^(INGRESO|EGRESO)$", message = "El tipo de movimiento debe ser INGRESO o EGRESO")
    private String tipoMovimiento;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero")
    @Digits(integer = 10, fraction = 2, message = "El monto debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal monto;

    @NotBlank(message = "El concepto es obligatorio")
    @Size(max = 255, message = "El concepto no puede superar 255 caracteres")
    private String concepto;
}
