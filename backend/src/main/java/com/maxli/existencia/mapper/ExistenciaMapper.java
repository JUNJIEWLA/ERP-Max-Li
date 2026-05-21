package com.maxli.existencia.mapper;

import com.maxli.existencia.dto.ExistenciaRequestDTO;
import com.maxli.existencia.dto.ExistenciaResponseDTO;
import com.maxli.existencia.entity.Existencia;
import com.maxli.producto.entity.Producto;
import org.springframework.stereotype.Component;

@Component
public class ExistenciaMapper {

    public Existencia toEntity(ExistenciaRequestDTO dto, Producto producto) {
        Existencia existencia = new Existencia();
        existencia.setProducto(producto);
        existencia.setCantidadActual(dto.getCantidadActual());
        existencia.setCantidadMinima(dto.getCantidadMinima());
        return existencia;
    }

    public ExistenciaResponseDTO toDto(Existencia existencia) {
        ExistenciaResponseDTO dto = new ExistenciaResponseDTO();
        dto.setIdExistencia(existencia.getIdExistencia());
        dto.setIdProducto(existencia.getProducto().getIdProducto());
        dto.setProductoCodigo(existencia.getProducto().getCodigo());
        dto.setProductoNombre(existencia.getProducto().getNombre());
        dto.setProductoEstado(existencia.getProducto().getEstado());
        dto.setCantidadActual(existencia.getCantidadActual());
        dto.setCantidadMinima(existencia.getCantidadMinima());
        dto.setBajoPuntoReorden(existencia.getCantidadActual() < existencia.getCantidadMinima());
        dto.setFechaCreacion(existencia.getFechaCreacion());
        dto.setFechaModificacion(existencia.getFechaModificacion());
        return dto;
    }
}
