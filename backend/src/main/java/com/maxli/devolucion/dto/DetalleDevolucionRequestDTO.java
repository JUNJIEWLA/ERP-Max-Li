package com.maxli.devolucion.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DetalleDevolucionRequestDTO {

    @NotNull(message = "El id de la línea de venta es obligatorio")
    private Long idDetalleVenta;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad mínima a devolver es 1")
    private Integer cantidad;
}
