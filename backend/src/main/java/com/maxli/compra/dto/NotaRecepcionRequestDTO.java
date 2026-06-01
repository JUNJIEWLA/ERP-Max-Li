package com.maxli.compra.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class NotaRecepcionRequestDTO {

    @NotNull(message = "La orden de compra es obligatoria")
    private Long idOrdenCompra;

    @NotEmpty(message = "La nota debe tener al menos un producto recibido")
    @Valid
    private List<DetalleNotaRecepcionRequestDTO> detalles;
}
