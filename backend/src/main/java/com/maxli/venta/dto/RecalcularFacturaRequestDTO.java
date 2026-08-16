package com.maxli.venta.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Request para recalcular la factura (preview, no persiste).
 * Se invoca cuando el cajero cambia el método de pago o el tipo de NCF.
 */
@Getter
@Setter
public class RecalcularFacturaRequestDTO {

    @NotNull(message = "El método de pago es obligatorio")
    private String metodoPago;

    @NotNull(message = "El tipo de NCF es obligatorio")
    @Size(max = 10)
    private String tipoNcf;

    private boolean usaPrecioMayor;

    @DecimalMin(value = "0.00", message = "El descuento global no puede ser negativo")
    private java.math.BigDecimal descuentoGlobal;

    /** Código de cupón digitado (opcional) — se previsualiza sin consumir su límite de usos. */
    @Size(max = 50)
    private String codigoCupon;

    @NotEmpty(message = "Debe incluir al menos un producto")
    @Valid
    private List<DetalleVentaRequestDTO> detalles;
}

