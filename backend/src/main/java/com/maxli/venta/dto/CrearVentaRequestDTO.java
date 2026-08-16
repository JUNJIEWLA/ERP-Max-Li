package com.maxli.venta.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class CrearVentaRequestDTO {

    @NotNull(message = "El id del turno de caja es obligatorio")
    private Long idTurnoCaja;

    /** ID de cliente registrado (opcional). */
    private Long idCliente;

    /** Nombre del cliente de paso — se guarda en la venta sin crear registro. */
    @Size(max = 200, message = "El nombre del cliente no puede superar 200 caracteres")
    private String nombreClienteTemporal;

    /** RNC del cliente de paso — se imprime en la factura. */
    @Size(max = 20, message = "El RNC no puede superar 20 caracteres")
    private String rncTemporal;

    /** Tipo de NCF solicitado: B01, B02, B14, B15. */
    @NotNull(message = "El tipo de NCF es obligatorio")
    @Size(max = 10)
    private String tipoNcf;

    /** Método de pago principal: EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE, MIXTO. */
    @NotNull(message = "El método de pago es obligatorio")
    private String metodoPago;

    /** true si el cajero solicitó precios al por mayor. */
    private boolean usaPrecioMayor;

    /** Descuento global en monto fijo (RD$). */
    @DecimalMin(value = "0.00", message = "El descuento global no puede ser negativo")
    private BigDecimal descuentoGlobal = BigDecimal.ZERO;

    /** Código de cupón digitado (opcional). */
    @Size(max = 50)
    private String codigoCupon;

    @NotEmpty(message = "Debe incluir al menos un producto")
    @Valid
    private List<DetalleVentaRequestDTO> detalles;

    @NotEmpty(message = "Debe incluir al menos un método de pago")
    @Valid
    private List<IngresoVentaRequestDTO> ingresos;
}
