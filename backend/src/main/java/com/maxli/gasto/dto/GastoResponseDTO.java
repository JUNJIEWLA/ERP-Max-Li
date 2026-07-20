package com.maxli.gasto.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class GastoResponseDTO {

    private Long idGasto;
    private Long idOrdenCompra;
    private String nombreProveedor;
    private BigDecimal monto;
    private String estado;
    private LocalDateTime fechaRegistro;
    private LocalDateTime fechaRealizado;
}
