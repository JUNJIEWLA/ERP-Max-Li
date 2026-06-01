package com.maxli.caja.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class CuadreTurnoCajaResponseDTO {

    private Long idTurnoCaja;
    private BigDecimal totalVentasEfectivo;
    private BigDecimal totalVentasTarjeta;
    private BigDecimal totalVentasTransferencia;
    private BigDecimal totalOtrosIngresos;
    private BigDecimal totalEgresos;
    private BigDecimal montoEsperado;
    private BigDecimal montoFinalDeclarado;
    private BigDecimal diferencia;
    private LocalDateTime calculadoEn;
}
