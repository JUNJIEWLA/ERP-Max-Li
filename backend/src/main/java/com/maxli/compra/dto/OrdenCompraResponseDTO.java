package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class OrdenCompraResponseDTO {

    private Long idOrdenCompra;
    private Long idProveedor;
    private String nombreProveedor;
    private BigDecimal total;
    private String estado;

    // Calculados dinámicamente
    private BigDecimal totalPagado;
    private BigDecimal balancePendiente;

    /**
     * PENDIENTE | PARCIAL | SALDADO — calculado a partir de totalPagado vs total
     */
    private String estadoPago;

    private List<DetalleOrdenCompraResponseDTO> detalles;
    private List<PagoProveedorResponseDTO> pagos;

    private LocalDateTime fechaOrden;
    private LocalDateTime fechaModificacion;
}
