package com.maxli.conteo.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ConteoResumenResponseDTO {

    private Long idConteo;
    private String almacenNombre;
    private String zona;
    private String estado;
    private String usernameAsignado;
    private String usernameSupervisor;
    private String observacion;
    private int totalItems;
    private int totalDiscrepancias;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaAplicacion;
}
