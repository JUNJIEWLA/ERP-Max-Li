package com.maxli.existencia.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AjusteExistenciaRequestDTO {

    @NotNull(message = "La variación de cantidad es obligatoria")
    private Integer deltaCantidadActual;

    @NotNull(message = "La cantidad mínima es obligatoria")
    @Min(value = 0, message = "La cantidad mínima no puede ser negativa")
    private Integer cantidadMinima;
}
