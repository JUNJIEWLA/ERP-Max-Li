package com.maxli.cupon.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** DTO devuelto al POS cuando el cupón es válido y se puede aplicar. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CuponAplicadoDTO {
    private Long idCupon;
    private String codigoInterno;
    private String codigoSecreto;
    private String tipoDescuento;       // "MONTO_FIJO" | "PORCENTAJE"
    private BigDecimal valorDescuento;
    private BigDecimal montoDescontado; // Monto calculado sobre el subtotal real
}
