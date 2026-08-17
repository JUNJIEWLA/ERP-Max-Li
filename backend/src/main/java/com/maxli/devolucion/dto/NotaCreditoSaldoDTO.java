package com.maxli.devolucion.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotaCreditoSaldoDTO {

    private Long idDevolucion;
    private String numeroControl;
    private String ncf;
    private String numeroControlVenta;
    private String ncfAfectado;
    private String nombreCliente;
    private BigDecimal totalDevolucion;
    private BigDecimal montoDisponible;
    private BigDecimal montoUsado;
    private LocalDateTime fechaDevolucion;
}
