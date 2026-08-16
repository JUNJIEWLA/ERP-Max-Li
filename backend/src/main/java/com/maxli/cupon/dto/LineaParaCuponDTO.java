package com.maxli.cupon.dto;

import java.math.BigDecimal;

/**
 * Línea del carrito tal como la ve {@link com.maxli.cupon.service.CuponService}
 * para determinar elegibilidad por categoría y prorratear el descuento
 * únicamente entre las líneas habilitadas por el cupón (ISSUE-008).
 *
 * @param idCategoria categoría del producto de la línea
 * @param importe     importe de la línea ya neto de descuento de línea/oferta
 *                    y de descuento global (el cupón se aplica de último)
 */
public record LineaParaCuponDTO(Long idCategoria, BigDecimal importe) {
}
