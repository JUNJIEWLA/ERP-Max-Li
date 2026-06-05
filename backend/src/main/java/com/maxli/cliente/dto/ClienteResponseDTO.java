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
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
