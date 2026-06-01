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
public class AbrirTurnoCajaRequestDTO {

    @NotNull(message = "La caja es obligatoria")
    private Long idCaja;

    @NotNull(message = "El monto inicial es obligatorio")
    @DecimalMin(value = "0.00", message = "El monto inicial no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El monto inicial debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal montoInicial;

    @Size(max = 500, message = "La observacion no puede superar 500 caracteres")
    private String observacionApertura;
}
