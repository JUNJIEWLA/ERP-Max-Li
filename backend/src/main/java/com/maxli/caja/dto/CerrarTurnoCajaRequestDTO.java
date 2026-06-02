package com.maxli.caja.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CerrarTurnoCajaRequestDTO {

    @NotNull(message = "El monto final declarado es obligatorio")
    @DecimalMin(value = "0.00", message = "El monto final declarado no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El monto final declarado debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal montoFinalDeclarado;

    @Size(max = 500, message = "La observacion no puede superar 500 caracteres")
    private String observacionCierre;
}
