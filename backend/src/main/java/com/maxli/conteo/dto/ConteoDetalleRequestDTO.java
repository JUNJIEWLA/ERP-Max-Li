package com.maxli.conteo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConteoDetalleRequestDTO {

    @NotNull(message = "El producto es obligatorio")
    private Long idProducto;

    @NotNull(message = "La cantidad física es obligatoria")
    @Min(value = 0, message = "La cantidad física no puede ser negativa")
    private Integer cantidadFisica;
}
