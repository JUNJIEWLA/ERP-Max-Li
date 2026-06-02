package com.maxli.caja.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class MovimientoCajaResponseDTO {

    private Long idMovimiento;
    private Long idCajaChica;
    private String cajaChicaNombre;
    private String tipoMovimiento;
    private LocalDateTime fechaHora;
    private BigDecimal monto;
    private String concepto;
    private Long idUsuario;
    private String username;
    private BigDecimal saldoActualCajaChica;
}
