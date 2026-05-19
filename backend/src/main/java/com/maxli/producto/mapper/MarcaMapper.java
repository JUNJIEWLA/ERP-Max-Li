package com.maxli.producto.mapper;

import com.maxli.producto.dto.MarcaRequestDTO;
import com.maxli.producto.dto.MarcaResponseDTO;
import com.maxli.producto.entity.Marca;
import org.springframework.stereotype.Component;

@Component
public class MarcaMapper {

    public Marca toEntity(MarcaRequestDTO dto) {
        Marca marca = new Marca();
        marca.setNombre(dto.getNombre());
        marca.setDescripcion(dto.getDescripcion());
        marca.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return marca;
    }

    public MarcaResponseDTO toDto(Marca marca) {
        MarcaResponseDTO dto = new MarcaResponseDTO();
        dto.setIdMarca(marca.getIdMarca());
        dto.setNombre(marca.getNombre());
        dto.setDescripcion(marca.getDescripcion());
        dto.setEstado(marca.getEstado());
        dto.setFechaCreacion(marca.getFechaCreacion());
        dto.setFechaModificacion(marca.getFechaModificacion());
        return dto;
    }
}
