package com.maxli.caja.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class TurnoCajaResponseDTO {

    private Long idTurnoCaja;
    private Long idCaja;
    private String cajaNombre;
    private Long idAlmacen;
    private String almacenNombre;
    private Long idUsuarioApertura;
    private String usernameUsuarioApertura;
    private Long idUsuarioCierre;
    private String usernameUsuarioCierre;
    private BigDecimal montoInicial;
    private BigDecimal montoFinalDeclarado;
    private BigDecimal totalVentasEfectivo;
    private BigDecimal totalVentasTarjeta;
    private BigDecimal totalVentasTransferencia;
    private BigDecimal totalVentasNotaCredito;
    private BigDecimal totalOtrosIngresos;
    private BigDecimal totalEgresos;
    private BigDecimal montoEsperado;
    private BigDecimal diferencia;
    private String estado;
    private String observacionApertura;
    private String observacionCierre;
    private LocalDateTime fechaApertura;
    private LocalDateTime fechaCierre;
    private LocalDateTime fechaModificacion;
}
