package com.maxli.conteo.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class ConteoCabeceraResponseDTO {

    private Long idConteo;
    private Long idAlmacen;
    private String almacenNombre;
    private String zona;
    private String estado;
    private Long idUsuarioAsignado;
    private String usernameAsignado;
    private Long idUsuarioSupervisor;
    private String usernameSupervisor;
    private String observacion;
    private LocalDateTime fechaAplicacion;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
    private List<ConteoDetalleResponseDTO> detalles;
}
