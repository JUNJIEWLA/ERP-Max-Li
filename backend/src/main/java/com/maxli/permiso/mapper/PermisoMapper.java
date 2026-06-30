package com.maxli.permiso.mapper;

import com.maxli.permiso.dto.PermisoResponseDTO;
import com.maxli.permiso.entity.Permiso;
import org.springframework.stereotype.Component;

@Component
public class PermisoMapper {

    public PermisoResponseDTO toDto(Permiso permiso) {
        PermisoResponseDTO dto = new PermisoResponseDTO();
        dto.setIdPermiso(permiso.getIdPermiso());
        dto.setNombreClave(permiso.getNombreClave());
        dto.setDescripcion(permiso.getDescripcion());
        dto.setModulo(permiso.getModulo());
        return dto;
    }
}
