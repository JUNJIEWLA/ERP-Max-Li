package com.maxli.producto.mapper;

import com.maxli.producto.dto.AlertaCostoResponseDTO;
import com.maxli.producto.entity.AlertaCosto;
import org.springframework.stereotype.Component;

@Component
public class AlertaCostoMapper {

    public AlertaCostoResponseDTO toDto(AlertaCosto entity) {
        AlertaCostoResponseDTO dto = new AlertaCostoResponseDTO();
        dto.setIdAlertaCosto(entity.getIdAlertaCosto());
        dto.setIdProducto(entity.getProducto().getIdProducto());
        dto.setNombreProducto(entity.getNombreProducto());
        dto.setCostoAnterior(entity.getCostoAnterior());
        dto.setCostoNuevo(entity.getCostoNuevo());
        dto.setPrecioVentaActual(entity.getPrecioVentaActual());
        dto.setPrecioVentaSugerido(entity.getPrecioVentaSugerido());
        dto.setPrecioVentaMayorActual(entity.getPrecioVentaMayorActual());
        dto.setPrecioVentaMayorSugerido(entity.getPrecioVentaMayorSugerido());
        dto.setPorcentajeVariacion(entity.getPorcentajeVariacion());
        dto.setPorcentajeMargen(entity.getPorcentajeMargen());
        dto.setPorcentajeMargenMayor(entity.getPorcentajeMargenMayor());
        dto.setEstado(entity.getEstado());
        dto.setFechaCreacion(entity.getFechaCreacion());
        dto.setFechaResolucion(entity.getFechaResolucion());
        return dto;
    }
}
