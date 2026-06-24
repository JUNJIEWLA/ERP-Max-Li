package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class AlertaRetrasoOcResponseDTO {

    private Long idAlertaRetraso;
    private Long idOrdenCompra;
    private String nombreProveedor;
    private LocalDate fechaLlegadaAcordada;

    /** Días transcurridos desde la fecha acordada (siempre >= 0 cuando la alerta existe). */
    private Integer diasRetraso;

    /** PENDIENTE | LEIDA */
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
