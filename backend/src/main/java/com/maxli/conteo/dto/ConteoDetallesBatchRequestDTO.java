package com.maxli.conteo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ConteoDetallesBatchRequestDTO {

    @NotEmpty(message = "Debe incluir al menos una línea de conteo")
    @Valid
    private List<ConteoDetalleRequestDTO> lineas;
}
