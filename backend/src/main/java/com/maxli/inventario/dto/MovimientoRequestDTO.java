package com.maxli.inventario.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class MovimientoRequestDTO {

    @NotNull(message = "El almacén de origen es obligatorio para transferencias")
    private Long idAlmacenOrigen;

    @NotNull(message = "El almacén de destino es obligatorio para transferencias")
    private Long idAlmacenDestino;

    @Size(max = 100, message = "La referencia no puede superar 100 caracteres")
    private String referencia;

    @Size(max = 500, message = "La observación no puede superar 500 caracteres")
    private String observacion;

    @NotEmpty(message = "Debe incluir al menos un producto en la transferencia")
    @Valid
    private List<DetalleMovimientoRequestDTO> detalles;
}
