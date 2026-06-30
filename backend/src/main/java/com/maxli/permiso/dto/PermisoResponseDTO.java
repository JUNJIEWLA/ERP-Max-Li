package com.maxli.permiso.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PermisoResponseDTO {

    private Long idPermiso;
    private String nombreClave;
    private String descripcion;
    private String modulo;
}
