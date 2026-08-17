package com.maxli.devolucion.dto;

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
public class CrearDevolucionRequestDTO {

    @NotNull(message = "El id de la venta es obligatorio")
    private Long idVenta;

    @NotNull(message = "El id del turno de caja es obligatorio")
    private Long idTurnoCaja;

    @NotBlank(message = "El motivo de la devolución es obligatorio")
    @Size(max = 300, message = "El motivo no puede superar 300 caracteres")
    private String motivo;

    /**
     * Destino del crédito. Solo admite {@code NOTA_CREDITO}, que es lo que
     * emite toda devolución; omitirlo equivale a enviarlo. Cualquier otro valor
     * se rechaza: la tienda no reembolsa en dinero.
     */
    private String metodoReembolso;

    /**
     * Llave de idempotencia generada por el cliente. Repetirla devuelve 409 sin
     * volver a reponer stock, ajustar caja ni consumir un comprobante.
     */
    @NotBlank(message = "La referencia de operación es obligatoria")
    @Size(max = 80, message = "La referencia de operación no puede superar 80 caracteres")
    private String referenciaOperacion;

    @NotEmpty(message = "Debe incluir al menos una línea a devolver")
    @Valid
    private List<DetalleDevolucionRequestDTO> detalles;
}
