package com.maxli.producto.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AlertaCostoAccionMasivaDTO {

    @NotEmpty(message = "Debe incluir al menos un ID de alerta")
    private List<Long> ids;
}
