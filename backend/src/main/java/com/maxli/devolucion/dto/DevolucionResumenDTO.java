package com.maxli.devolucion.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Una fila del historial de devoluciones: lo que la tabla muestra, nada más. */
@Getter
@Setter
public class DevolucionResumenDTO {

    private Long idDevolucion;
    private String numeroControl;
    private String referenciaOperacion;
    private LocalDateTime fechaDevolucion;
    private String ncf;
    private String ncfAfectado;
    private Long idVenta;
    private String numeroControlVenta;
    private String cajeroNombre;
    private String metodoReembolso;
    private BigDecimal total;
    private String estado;
}
