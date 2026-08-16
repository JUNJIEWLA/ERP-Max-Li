package com.maxli.inventario.mapper;

import com.maxli.inventario.dto.DetalleMovimientoResponseDTO;
import com.maxli.inventario.dto.MovimientoResponseDTO;
import com.maxli.inventario.entity.DetalleMovimiento;
import com.maxli.inventario.entity.Movimiento;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class MovimientoMapper {

    public MovimientoResponseDTO toDto(Movimiento movimiento) {
        MovimientoResponseDTO dto = new MovimientoResponseDTO();
        dto.setIdMovimiento(movimiento.getIdMovimiento());
        dto.setTipo(movimiento.getTipo());

        if (movimiento.getAlmacenOrigen() != null) {
            dto.setIdAlmacenOrigen(movimiento.getAlmacenOrigen().getIdAlmacen());
            dto.setAlmacenOrigenNombre(movimiento.getAlmacenOrigen().getNombre());
        }
        if (movimiento.getAlmacenDestino() != null) {
            dto.setIdAlmacenDestino(movimiento.getAlmacenDestino().getIdAlmacen());
            dto.setAlmacenDestinoNombre(movimiento.getAlmacenDestino().getNombre());
        }

        dto.setReferencia(movimiento.getReferencia());
        dto.setObservacion(movimiento.getObservacion());
        dto.setEstado(movimiento.getEstado());
        dto.setUsuarioResponsable(movimiento.getUsuarioResponsable());
        dto.setFechaMovimiento(movimiento.getFechaMovimiento());
        dto.setFechaCreacion(movimiento.getFechaCreacion());
        dto.setFechaModificacion(movimiento.getFechaModificacion());

        if (movimiento.getDetalles() != null) {
            dto.setDetalles(toDetallesDtoList(movimiento.getDetalles()));
        }

        return dto;
    }

    public DetalleMovimientoResponseDTO toDetalleDto(DetalleMovimiento detalle) {
        DetalleMovimientoResponseDTO dto = new DetalleMovimientoResponseDTO();
        dto.setIdDetalleMovimiento(detalle.getIdDetalleMovimiento());
        dto.setIdProducto(detalle.getProducto().getIdProducto());
        dto.setProductoNombre(detalle.getProducto().getNombre());
        dto.setProductoSku(detalle.getProducto().getSku());
        dto.setCantidad(detalle.getCantidad());
        dto.setCantidadAnteriorOrigen(detalle.getCantidadAnteriorOrigen());
        dto.setCantidadPosteriorOrigen(detalle.getCantidadPosteriorOrigen());
        dto.setCantidadAnteriorDestino(detalle.getCantidadAnteriorDestino());
        dto.setCantidadPosteriorDestino(detalle.getCantidadPosteriorDestino());
        return dto;
    }

    private List<DetalleMovimientoResponseDTO> toDetallesDtoList(List<DetalleMovimiento> detalles) {
        return detalles.stream()
                .map(this::toDetalleDto)
                .collect(Collectors.toList());
    }
}
