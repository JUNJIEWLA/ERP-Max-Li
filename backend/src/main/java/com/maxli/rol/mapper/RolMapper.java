package com.maxli.rol.mapper;

import com.maxli.rol.dto.RolRequestDTO;
import com.maxli.rol.dto.RolResponseDTO;
import com.maxli.rol.entity.Rol;
import org.springframework.stereotype.Component;

@Component
public class RolMapper {

    public Rol toEntity(RolRequestDTO dto) {
        Rol rol = new Rol();
        rol.setNombre(dto.getNombre().toUpperCase());
        return rol;
    }

    public RolResponseDTO toDto(Rol rol) {
        RolResponseDTO dto = new RolResponseDTO();
        dto.setIdRol(rol.getIdRol());
        dto.setNombre(rol.getNombre());
        return dto;
    }
}
