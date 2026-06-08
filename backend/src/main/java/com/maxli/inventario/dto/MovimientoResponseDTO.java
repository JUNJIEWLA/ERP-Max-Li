package com.maxli.inventario.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class MovimientoResponseDTO {

    private Long idMovimiento;
    private String tipo;
    private Long idAlmacenOrigen;
    private String almacenOrigenNombre;
    private Long idAlmacenDestino;
    private String almacenDestinoNombre;
    private String referencia;
    private String observacion;
    private String estado;
    private String usuarioResponsable;
    private LocalDateTime fechaMovimiento;
    private List<DetalleMovimientoResponseDTO> detalles;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
