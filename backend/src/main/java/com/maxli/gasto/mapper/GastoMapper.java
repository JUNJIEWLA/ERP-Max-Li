package com.maxli.gasto.mapper;

import com.maxli.gasto.dto.GastoResponseDTO;
import com.maxli.gasto.entity.Gasto;
import org.springframework.stereotype.Component;

@Component
public class GastoMapper {

    public GastoResponseDTO toDto(Gasto gasto) {
        GastoResponseDTO dto = new GastoResponseDTO();
        dto.setIdGasto(gasto.getIdGasto());
        dto.setIdOrdenCompra(gasto.getOrdenCompra().getIdOrdenCompra());
        dto.setNombreProveedor(gasto.getOrdenCompra().getProveedor().getNombreEmpresa());
        dto.setMonto(gasto.getMonto());
        dto.setEstado(gasto.getEstado());
        dto.setFechaRegistro(gasto.getFechaRegistro());
        dto.setFechaRealizado(gasto.getFechaRealizado());
        return dto;
    }
}
