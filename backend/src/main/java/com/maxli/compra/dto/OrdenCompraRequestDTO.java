package com.maxli.compra.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class OrdenCompraRequestDTO {

    @NotNull(message = "El proveedor es obligatorio")
    private Long idProveedor;

    /**
     * Fecha en que el proveedor se comprometió a entregar.
     * Opcional. Cuando se define, el sistema monitorea el retraso automáticamente.
     */
    private LocalDate fechaLlegadaAcordada;

    @NotEmpty(message = "La orden debe tener al menos un producto")
    @Valid
    private List<DetalleOrdenCompraRequestDTO> detalles;
}
