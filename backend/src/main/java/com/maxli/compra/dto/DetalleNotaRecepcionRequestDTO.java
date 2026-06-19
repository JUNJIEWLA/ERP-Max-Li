package com.maxli.compra.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DetalleNotaRecepcionRequestDTO {

    @NotNull(message = "El detalle de orden de compra es obligatorio")
    private Long idDetalleOrdenCompra;

    @NotNull(message = "La cantidad recibida es obligatoria")
    @Min(value = 1, message = "La cantidad recibida debe ser al menos 1")
    private Integer cantidadRecibida;

    @NotBlank(message = "La observación es obligatoria")
    @Pattern(regexp = "^(CONFORME|DAÑADO|INCOMPLETO)$",
            message = "La observación debe ser CONFORME, DAÑADO o INCOMPLETO")
    private String observacion;

    @Size(max = 500, message = "Las notas no pueden superar 500 caracteres")
    private String notas;

    @NotNull(message = "El almacén es obligatorio")
    private Long idAlmacen;
}
