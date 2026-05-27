package com.maxli.almacen.mapper;

import com.maxli.almacen.dto.AlmacenRequestDTO;
import com.maxli.almacen.dto.AlmacenResponseDTO;
import com.maxli.almacen.entity.Almacen;
import org.springframework.stereotype.Component;

@Component
public class AlmacenMapper {

    public Almacen toEntity(AlmacenRequestDTO dto) {
        Almacen almacen = new Almacen();
        almacen.setNombre(dto.getNombre().trim());
        almacen.setDescripcion(dto.getDescripcion());
        almacen.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return almacen;
    }

    public AlmacenResponseDTO toDto(Almacen almacen) {
        AlmacenResponseDTO dto = new AlmacenResponseDTO();
        dto.setIdAlmacen(almacen.getIdAlmacen());
        dto.setNombre(almacen.getNombre());
        dto.setDescripcion(almacen.getDescripcion());
        dto.setEstado(almacen.getEstado());
        dto.setFechaCreacion(almacen.getFechaCreacion());
        dto.setFechaModificacion(almacen.getFechaModificacion());
        return dto;
    }
}
