package com.maxli.cliente.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class ClienteResponseDTO {

    private Long idCliente;
    private String nombreCompleto;
    private String rncCedula;
    private String telefono;
    private String email;
    private String direccion;
    private String tipoNcfPreferido;
    private BigDecimal descuentoPredeterminado;
    private BigDecimal totalCompras;
    private String estado;

    /** Días de plazo de crédito configurados (0 = sin crédito). */
    private Integer diasCredito;

    /** Monto máximo de crédito autorizado en DOP (0 = sin crédito). */
    private BigDecimal montoLimiteCredito;

    /**
     * Estado del crédito calculado por el servicio:
     * SIN_CREDITO → diasCredito=0 o montoLimiteCredito=0.
     * AL_DIA      → crédito activo y dentro del límite.
     * BLOQUEADO   → crédito activo pero excede el límite o el plazo.
     */
    private String estadoCredito;

    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
