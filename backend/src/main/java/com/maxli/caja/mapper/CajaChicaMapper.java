package com.maxli.caja.mapper;

import com.maxli.caja.dto.CajaChicaRequestDTO;
import com.maxli.caja.dto.CajaChicaResponseDTO;
import com.maxli.caja.entity.CajaChica;
import org.springframework.stereotype.Component;

@Component
public class CajaChicaMapper {

    public CajaChica toEntity(CajaChicaRequestDTO dto) {
        CajaChica cajaChica = new CajaChica();
        cajaChica.setNombre(dto.getNombre());
        cajaChica.setResponsable(dto.getResponsable());
        cajaChica.setSaldoActual(dto.getSaldoActual());
        cajaChica.setLimiteMonto(dto.getLimiteMonto());
        cajaChica.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return cajaChica;
    }

    public CajaChicaResponseDTO toDto(CajaChica cajaChica) {
        CajaChicaResponseDTO dto = new CajaChicaResponseDTO();
        dto.setIdCajaChica(cajaChica.getIdCajaChica());
        dto.setNombre(cajaChica.getNombre());
        dto.setResponsable(cajaChica.getResponsable());
        dto.setSaldoActual(cajaChica.getSaldoActual());
        dto.setLimiteMonto(cajaChica.getLimiteMonto());
        dto.setEstado(cajaChica.getEstado());
        dto.setFechaCreacion(cajaChica.getFechaCreacion());
        dto.setFechaModificacion(cajaChica.getFechaModificacion());
        return dto;
    }
}
