package com.maxli.caja.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class CajaChicaResponseDTO {

    private Long idCajaChica;
    private String nombre;
    private String responsable;
    private BigDecimal saldoActual;
    private BigDecimal limiteMonto;
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
