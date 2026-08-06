package com.maxli.venta.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class IngresoVentaRequestDTO {

    /** EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE, CUPON. */
    @NotNull(message = "El método de pago es obligatorio")
    private String metodoPago;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero")
    private BigDecimal monto;

    /** Número de referencia (tarjeta, transferencia, cheque). */
    @Size(max = 100)
    private String referencia;
}
