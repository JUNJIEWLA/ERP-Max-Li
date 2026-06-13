package com.maxli.conteo.mapper;

import com.maxli.conteo.dto.ConteoCabeceraResponseDTO;
import com.maxli.conteo.dto.ConteoDetalleResponseDTO;
import com.maxli.conteo.dto.ConteoResumenResponseDTO;
import com.maxli.conteo.entity.ConteoCabecera;
import com.maxli.conteo.entity.ConteoDetalle;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ConteoMapper {

    public ConteoCabeceraResponseDTO toDto(ConteoCabecera cabecera) {
        ConteoCabeceraResponseDTO dto = new ConteoCabeceraResponseDTO();
        dto.setIdConteo(cabecera.getIdConteo());
        dto.setIdAlmacen(cabecera.getAlmacen().getIdAlmacen());
        dto.setAlmacenNombre(cabecera.getAlmacen().getNombre());
        dto.setZona(cabecera.getZona());
        dto.setEstado(cabecera.getEstado());
        dto.setIdUsuarioAsignado(cabecera.getUsuarioAsignado().getIdUsuario());
        dto.setUsernameAsignado(cabecera.getUsuarioAsignado().getUsername());

        if (cabecera.getUsuarioSupervisor() != null) {
            dto.setIdUsuarioSupervisor(cabecera.getUsuarioSupervisor().getIdUsuario());
            dto.setUsernameSupervisor(cabecera.getUsuarioSupervisor().getUsername());
        }

        dto.setObservacion(cabecera.getObservacion());
        dto.setFechaAplicacion(cabecera.getFechaAplicacion());
        dto.setFechaCreacion(cabecera.getFechaCreacion());
        dto.setFechaModificacion(cabecera.getFechaModificacion());

        if (cabecera.getDetalles() != null) {
            dto.setDetalles(toDetalleDtoList(cabecera.getDetalles()));
        }

        return dto;
    }

    public ConteoResumenResponseDTO toResumenDto(ConteoCabecera cabecera) {
        ConteoResumenResponseDTO dto = new ConteoResumenResponseDTO();
        dto.setIdConteo(cabecera.getIdConteo());
        dto.setAlmacenNombre(cabecera.getAlmacen().getNombre());
        dto.setZona(cabecera.getZona());
        dto.setEstado(cabecera.getEstado());
        dto.setUsernameAsignado(cabecera.getUsuarioAsignado().getUsername());
        dto.setObservacion(cabecera.getObservacion());
        dto.setFechaCreacion(cabecera.getFechaCreacion());
        dto.setFechaAplicacion(cabecera.getFechaAplicacion());

        if (cabecera.getUsuarioSupervisor() != null) {
            dto.setUsernameSupervisor(cabecera.getUsuarioSupervisor().getUsername());
        }

        if (cabecera.getDetalles() != null) {
            dto.setTotalItems(cabecera.getDetalles().size());
            dto.setTotalDiscrepancias((int) cabecera.getDetalles().stream()
                    .filter(d -> d.getDiferencia() != null && d.getDiferencia() != 0)
                    .count());
        }

        return dto;
    }

    public ConteoDetalleResponseDTO toDetalleDto(ConteoDetalle detalle) {
        ConteoDetalleResponseDTO dto = new ConteoDetalleResponseDTO();
        dto.setIdConteoDetalle(detalle.getIdConteoDetalle());
        dto.setIdProducto(detalle.getProducto().getIdProducto());
        dto.setProductoNombre(detalle.getProducto().getNombre());
        dto.setProductoSku(detalle.getProducto().getSku());
        dto.setProductoCodigoBarras(detalle.getProducto().getCodigoBarras());
        dto.setCantidadFisica(detalle.getCantidadFisica());
        dto.setCantidadSistema(detalle.getCantidadSistema());
        dto.setDiferencia(detalle.getDiferencia());
        dto.setFechaRegistro(detalle.getFechaRegistro());
        return dto;
    }

    private List<ConteoDetalleResponseDTO> toDetalleDtoList(List<ConteoDetalle> detalles) {
        return detalles.stream()
                .map(this::toDetalleDto)
                .collect(Collectors.toList());
    }
}
