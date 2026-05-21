package com.maxli.existencia.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExistenciaRequestDTO {

    @NotNull(message = "El producto es obligatorio")
    private Long idProducto;

    @NotNull(message = "La cantidad actual es obligatoria")
    @Min(value = 0, message = "La cantidad actual no puede ser negativa")
    private Integer cantidadActual;

    @NotNull(message = "La cantidad minima es obligatoria")
    @Min(value = 0, message = "La cantidad minima no puede ser negativa")
    private Integer cantidadMinima;
}
