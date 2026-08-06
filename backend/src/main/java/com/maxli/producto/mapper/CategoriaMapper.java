package com.maxli.producto.mapper;

import com.maxli.producto.dto.CategoriaRequestDTO;
import com.maxli.producto.dto.CategoriaResponseDTO;
import com.maxli.producto.entity.Categoria;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class CategoriaMapper {

    public Categoria toEntity(CategoriaRequestDTO dto) {
        Categoria categoria = new Categoria();
        categoria.setNombre(dto.getNombre());
        categoria.setDescripcion(dto.getDescripcion());
        categoria.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        categoria.setPorcentajeMargen(dto.getPorcentajeMargen() != null ? dto.getPorcentajeMargen() : BigDecimal.ZERO);
        categoria.setPorcentajeMargenMayor(dto.getPorcentajeMargenMayor() != null ? dto.getPorcentajeMargenMayor() : BigDecimal.ZERO);
        return categoria;
    }

    public CategoriaResponseDTO toDto(Categoria categoria) {
        CategoriaResponseDTO dto = new CategoriaResponseDTO();
        dto.setIdCategoria(categoria.getIdCategoria());
        dto.setNombre(categoria.getNombre());
        dto.setDescripcion(categoria.getDescripcion());
        dto.setEstado(categoria.getEstado());
        dto.setPorcentajeMargen(categoria.getPorcentajeMargen());
        dto.setPorcentajeMargenMayor(categoria.getPorcentajeMargenMayor());
        dto.setFechaCreacion(categoria.getFechaCreacion());
        dto.setFechaModificacion(categoria.getFechaModificacion());
        return dto;
    }
}

