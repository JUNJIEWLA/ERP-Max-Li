package com.maxli.conteo.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConteoCreateRequestDTO {

    @NotNull(message = "El almacén es obligatorio")
    private Long idAlmacen;

    @Size(max = 100, message = "La zona no puede superar 100 caracteres")
    private String zona;

    @NotNull(message = "El usuario asignado es obligatorio")
    private Long idUsuarioAsignado;

    @Size(max = 500, message = "La observación no puede superar 500 caracteres")
    private String observacion;
}
