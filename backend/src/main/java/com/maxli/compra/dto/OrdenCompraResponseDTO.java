package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class OrdenCompraResponseDTO {

    private Long idOrdenCompra;
    private Long idProveedor;
    private String nombreProveedor;
    private BigDecimal total;

    /** Monto realmente recibido cuando la orden se cerró con faltantes; null si llegó completa. */
    private BigDecimal totalRecepcionado;
    private String estado;

    private List<DetalleOrdenCompraResponseDTO> detalles;

    /** Fecha acordada con el proveedor para la entrega (puede ser null). */
    private LocalDate fechaLlegadaAcordada;

    /**
     * Días de retraso calculados. Null si no hay fecha acordada o si la OC ya está completada.
     * Positivo = hay retraso. 0 = venció hoy. Negativo no se expone (se usa null si la fecha no ha llegado).
     */
    private Integer diasRetraso;

    private LocalDateTime fechaOrden;
    private LocalDateTime fechaModificacion;
}
