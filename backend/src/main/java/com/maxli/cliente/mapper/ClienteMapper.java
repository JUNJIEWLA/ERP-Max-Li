package com.maxli.cliente.mapper;

import com.maxli.cliente.dto.ClienteRequestDTO;
import com.maxli.cliente.dto.ClienteResumenDTO;
import com.maxli.cliente.dto.ClienteResponseDTO;
import com.maxli.cliente.entity.Cliente;
import org.springframework.stereotype.Component;

@Component
public class ClienteMapper {

    public ClienteResponseDTO toDto(Cliente cliente) {
        ClienteResponseDTO dto = new ClienteResponseDTO();
        dto.setIdCliente(cliente.getIdCliente());
        dto.setNombreCompleto(cliente.getNombreCompleto());
        dto.setRncCedula(cliente.getRncCedula());
        dto.setTelefono(cliente.getTelefono());
        dto.setEmail(cliente.getEmail());
        dto.setDireccion(cliente.getDireccion());
        dto.setTipoNcfPreferido(cliente.getTipoNcfPreferido());
        dto.setDescuentoPredeterminado(cliente.getDescuentoPredeterminado());
        dto.setTotalCompras(cliente.getTotalCompras());
        dto.setEstado(cliente.getEstado());
        dto.setDiasCredito(cliente.getDiasCredito());
        dto.setMontoLimiteCredito(cliente.getMontoLimiteCredito());
        // estadoCredito es calculado por ClienteService, no aquí.
        dto.setFechaCreacion(cliente.getFechaCreacion());
        dto.setFechaModificacion(cliente.getFechaModificacion());
        return dto;
    }

    public ClienteResumenDTO toResumenDto(Cliente cliente) {
        ClienteResumenDTO dto = new ClienteResumenDTO();
        dto.setIdCliente(cliente.getIdCliente());
        dto.setNombreCompleto(cliente.getNombreCompleto());
        dto.setRncCedula(cliente.getRncCedula());
        dto.setTipoNcfPreferido(cliente.getTipoNcfPreferido());
        dto.setDescuentoPredeterminado(cliente.getDescuentoPredeterminado());
        return dto;
    }

    public Cliente toEntity(ClienteRequestDTO dto) {
        Cliente cliente = new Cliente();
        cliente.setNombreCompleto(dto.getNombreCompleto().trim());
        cliente.setRncCedula(dto.getRncCedula() != null ? dto.getRncCedula().trim() : null);
        cliente.setTelefono(dto.getTelefono());
        cliente.setEmail(dto.getEmail());
        cliente.setDireccion(dto.getDireccion());
        cliente.setTipoNcfPreferido(dto.getTipoNcfPreferido() != null ? dto.getTipoNcfPreferido() : "B02");
        cliente.setDescuentoPredeterminado(
                dto.getDescuentoPredeterminado() != null ? dto.getDescuentoPredeterminado() : java.math.BigDecimal.ZERO
        );
        cliente.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        cliente.setDiasCredito(dto.getDiasCredito() != null ? dto.getDiasCredito() : 0);
        cliente.setMontoLimiteCredito(
                dto.getMontoLimiteCredito() != null ? dto.getMontoLimiteCredito() : java.math.BigDecimal.ZERO
        );
        return cliente;
    }
}
