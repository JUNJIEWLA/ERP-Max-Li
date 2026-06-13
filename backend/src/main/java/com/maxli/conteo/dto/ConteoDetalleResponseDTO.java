package com.maxli.conteo.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ConteoDetalleResponseDTO {

    private Long idConteoDetalle;
    private Long idProducto;
    private String productoNombre;
    private String productoSku;
    private String productoCodigoBarras;
    private Integer cantidadFisica;
    private Integer cantidadSistema;
    private Integer diferencia;
    private LocalDateTime fechaRegistro;
}
