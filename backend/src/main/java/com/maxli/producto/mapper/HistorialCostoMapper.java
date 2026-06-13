package com.maxli.producto.mapper;

import com.maxli.producto.dto.HistorialCostoResponseDTO;
import com.maxli.producto.entity.HistorialCosto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class HistorialCostoMapper {

    public HistorialCostoResponseDTO toDto(HistorialCosto entity) {
        HistorialCostoResponseDTO dto = new HistorialCostoResponseDTO();
        dto.setIdHistorialCosto(entity.getIdHistorialCosto());
        dto.setIdProducto(entity.getProducto().getIdProducto());
        dto.setNombreProducto(entity.getProducto().getNombre());
        dto.setNombreProveedor(entity.getProveedor().getNombreEmpresa());
        dto.setCostoAnterior(entity.getCostoAnterior());
        dto.setCostoNuevo(entity.getCostoNuevo());
        dto.setCantidadRecibida(entity.getCantidadRecibida());
        dto.setFechaRegistro(entity.getFechaRegistro());

        // Calcular variación porcentual: ((nuevo - anterior) / anterior) * 100
        if (entity.getCostoAnterior().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal variacion = entity.getCostoNuevo()
                    .subtract(entity.getCostoAnterior())
                    .divide(entity.getCostoAnterior(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
            dto.setVariacionPorcentaje(variacion);
        } else {
            dto.setVariacionPorcentaje(BigDecimal.ZERO);
        }

        return dto;
    }
}
