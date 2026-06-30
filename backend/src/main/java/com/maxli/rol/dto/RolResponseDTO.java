package com.maxli.rol.dto;

import com.maxli.permiso.dto.PermisoResponseDTO;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

@Getter
@Setter
public class RolResponseDTO {

    private Long idRol;
    private String nombre;
    private String descripcion;
    private Set<PermisoResponseDTO> permisos;
}
