package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class PagoProveedorResponseDTO {

    private Long idPagoProveedor;
    private Long idOrdenCompra;
    private BigDecimal montoPagado;
    private String metodo;
    private String numeroReferencia;
    private LocalDateTime fecha;
}
