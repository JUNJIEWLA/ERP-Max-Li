package com.maxli.compra.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class NotaRecepcionResponseDTO {

    private Long idNotaRecepcion;
    private Long idOrdenCompra;
    private String estado;
    private List<DetalleNotaRecepcionResponseDTO> detalles;
    private LocalDateTime fechaRecepcion;
    private LocalDateTime fechaModificacion;
}
