package com.maxli.caja.mapper;

import com.maxli.caja.dto.CajaRequestDTO;
import com.maxli.caja.dto.CajaResponseDTO;
import com.maxli.caja.entity.Caja;
import org.springframework.stereotype.Component;

@Component
public class CajaMapper {

    public Caja toEntity(CajaRequestDTO dto) {
        Caja caja = new Caja();
        caja.setNombre(dto.getNombre());
        caja.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return caja;
    }

    public CajaResponseDTO toDto(Caja caja) {
        CajaResponseDTO dto = new CajaResponseDTO();
        dto.setIdCaja(caja.getIdCaja());
        dto.setNombre(caja.getNombre());
        dto.setEstado(caja.getEstado());
        if (caja.getAlmacen() != null) {
            dto.setIdAlmacen(caja.getAlmacen().getIdAlmacen());
            dto.setAlmacenNombre(caja.getAlmacen().getNombre());
        }
        dto.setFechaCreacion(caja.getFechaCreacion());
        dto.setFechaModificacion(caja.getFechaModificacion());
        return dto;
    }
}
