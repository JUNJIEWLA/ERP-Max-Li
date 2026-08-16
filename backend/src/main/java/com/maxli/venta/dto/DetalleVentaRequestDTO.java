package com.maxli.venta.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DetalleVentaRequestDTO {

    @NotNull(message = "El id del producto es obligatorio")
    private Long idProducto;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad mínima es 1")
    private Integer cantidad;

    /** Descuento porcentual por línea (0-100). */
    @DecimalMin(value = "0.00", message = "El descuento de línea no puede ser negativo")
    @DecimalMax(value = "100.00", message = "El descuento de línea no puede superar 100%")
    private BigDecimal descuentoLinea = BigDecimal.ZERO;
}
