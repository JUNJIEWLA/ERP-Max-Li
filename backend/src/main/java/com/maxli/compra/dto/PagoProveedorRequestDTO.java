package com.maxli.compra.dto;

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
public class PagoProveedorRequestDTO {

    @NotNull(message = "El monto a pagar es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    @Digits(integer = 10, fraction = 2, message = "El monto debe tener máximo 10 enteros y 2 decimales")
    private BigDecimal montoPagado;

    @NotBlank(message = "El método de pago es obligatorio")
    @Pattern(regexp = "^(EFECTIVO|TRANSFERENCIA|CHEQUE|TARJETA)$",
            message = "El método debe ser EFECTIVO, TRANSFERENCIA, CHEQUE o TARJETA")
    private String metodo;

    @Size(max = 100, message = "El número de referencia no puede superar 100 caracteres")
    private String numeroReferencia;
}
