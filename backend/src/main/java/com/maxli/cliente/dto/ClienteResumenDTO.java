package com.maxli.cliente.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * DTO ligero para el selector de clientes del POS.
 * Solo expone los campos necesarios para auto-rellenar NCF y descuento global.
 */
@Getter
@Setter
public class ClienteResumenDTO {

    private Long idCliente;
    private String nombreCompleto;
    private String rncCedula;
    private String tipoNcfPreferido;
    private BigDecimal descuentoPredeterminado;
}
