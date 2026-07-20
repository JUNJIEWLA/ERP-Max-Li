package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class ProveedorResponseDTO {

    private Long idProveedor;
    private String nombreEmpresa;
    private String rnc;
    private String ubicacion;
    private String vendedor;
    private String telefono;
    private String email;
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;

    /**
     * Calculado automáticamente: SUM(orden.total) - SUM(gastos realizados)
     * para todas las órdenes no anuladas de este proveedor.
     */
    private BigDecimal balancePendiente;
}
