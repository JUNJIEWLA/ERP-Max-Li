package com.maxli.compra.mapper;

import com.maxli.compra.dto.ProveedorRequestDTO;
import com.maxli.compra.dto.ProveedorResponseDTO;
import com.maxli.compra.entity.Proveedor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class ProveedorMapper {

    public Proveedor toEntity(ProveedorRequestDTO dto) {
        Proveedor p = new Proveedor();
        p.setNombreEmpresa(dto.getNombreEmpresa());
        p.setRnc(dto.getRnc());
        p.setUbicacion(dto.getUbicacion());
        p.setVendedor(dto.getVendedor());
        p.setTelefono(dto.getTelefono());
        p.setEmail(dto.getEmail());
        p.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return p;
    }

    public ProveedorResponseDTO toDto(Proveedor proveedor, BigDecimal balancePendiente) {
        ProveedorResponseDTO dto = new ProveedorResponseDTO();
        dto.setIdProveedor(proveedor.getIdProveedor());
        dto.setNombreEmpresa(proveedor.getNombreEmpresa());
        dto.setRnc(proveedor.getRnc());
        dto.setUbicacion(proveedor.getUbicacion());
        dto.setVendedor(proveedor.getVendedor());
        dto.setTelefono(proveedor.getTelefono());
        dto.setEmail(proveedor.getEmail());
        dto.setEstado(proveedor.getEstado());
        dto.setFechaCreacion(proveedor.getFechaCreacion());
        dto.setFechaModificacion(proveedor.getFechaModificacion());
        dto.setBalancePendiente(balancePendiente);
        return dto;
    }
}
