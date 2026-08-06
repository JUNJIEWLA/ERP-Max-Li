package com.maxli.gasto.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class OrdenCompraDisponibleDTO {

    private Long idOrdenCompra;
    private String nombreProveedor;
    private BigDecimal total;
}
