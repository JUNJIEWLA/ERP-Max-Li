package com.maxli.cupon.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

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
    private BigDecimal montoDescontado; // Monto realmente aplicado, calculado solo sobre las líneas elegibles

    /**
     * Índices (en el mismo orden que la lista de líneas enviada a
     * CuponService) de las líneas que pertenecen a una categoría habilitada
     * por el cupón. El llamador prorratea {@code montoDescontado} únicamente
     * entre estos índices — una línea fuera de este conjunto nunca recibe
     * descuento de cupón (ISSUE-008).
     */
    private List<Integer> indicesLineasElegibles;
}
