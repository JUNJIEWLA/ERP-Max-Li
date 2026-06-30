package com.maxli.rol.mapper;

import com.maxli.permiso.mapper.PermisoMapper;
import com.maxli.rol.dto.RolRequestDTO;
import com.maxli.rol.dto.RolResponseDTO;
import com.maxli.rol.entity.Rol;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RolMapper {

    private final PermisoMapper permisoMapper;

    public Rol toEntity(RolRequestDTO dto) {
        Rol rol = new Rol();
        rol.setNombre(dto.getNombre().toUpperCase());
        rol.setDescripcion(dto.getDescripcion());
        return rol;
    }

    public RolResponseDTO toDto(Rol rol) {
        RolResponseDTO dto = new RolResponseDTO();
        dto.setIdRol(rol.getIdRol());
        dto.setNombre(rol.getNombre());
        dto.setDescripcion(rol.getDescripcion());
        dto.setPermisos(
                rol.getPermisos().stream()
                        .map(permisoMapper::toDto)
                        .collect(Collectors.toSet())
        );
        return dto;
    }
}
