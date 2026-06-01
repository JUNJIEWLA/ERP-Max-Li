package com.maxli.compra.mapper;

import com.maxli.compra.dto.DetalleNotaRecepcionResponseDTO;
import com.maxli.compra.dto.NotaRecepcionResponseDTO;
import com.maxli.compra.entity.DetalleNotaRecepcion;
import com.maxli.compra.entity.NotaRecepcion;
import org.springframework.stereotype.Component;

@Component
public class NotaRecepcionMapper {

    public NotaRecepcionResponseDTO toDto(NotaRecepcion nota) {
        NotaRecepcionResponseDTO dto = new NotaRecepcionResponseDTO();
        dto.setIdNotaRecepcion(nota.getIdNotaRecepcion());
        dto.setIdOrdenCompra(nota.getOrdenCompra().getIdOrdenCompra());
        dto.setEstado(nota.getEstado());
        dto.setFechaRecepcion(nota.getFechaRecepcion());
        dto.setFechaModificacion(nota.getFechaModificacion());

        dto.setDetalles(nota.getDetalles().stream()
                .map(this::toDetalleDto)
                .toList());

        return dto;
    }

    public DetalleNotaRecepcionResponseDTO toDetalleDto(DetalleNotaRecepcion detalle) {
        DetalleNotaRecepcionResponseDTO dto = new DetalleNotaRecepcionResponseDTO();
        dto.setIdDetalleNotaRecepcion(detalle.getIdDetalleNotaRecepcion());
        dto.setIdDetalleOrdenCompra(detalle.getDetalleOrdenCompra().getIdDetalleOrdenCompra());
        dto.setIdProducto(detalle.getDetalleOrdenCompra().getProducto().getIdProducto());
        dto.setNombreProducto(detalle.getDetalleOrdenCompra().getProducto().getNombre());
        dto.setCantidadSolicitada(detalle.getDetalleOrdenCompra().getCantidad());
        dto.setCantidadRecibida(detalle.getCantidadRecibida());
        dto.setObservacion(detalle.getObservacion());
        dto.setNotas(detalle.getNotas());
        return dto;
    }
}
