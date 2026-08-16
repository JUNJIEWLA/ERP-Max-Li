package com.maxli.caja.mapper;

import com.maxli.caja.dto.TurnoCajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.usuario.entity.Usuario;
import org.springframework.stereotype.Component;

@Component
public class TurnoCajaMapper {

    public TurnoCajaResponseDTO toDto(TurnoCaja turno) {
        TurnoCajaResponseDTO dto = new TurnoCajaResponseDTO();
        dto.setIdTurnoCaja(turno.getIdTurnoCaja());
        dto.setMontoInicial(turno.getMontoInicial());
        dto.setMontoFinalDeclarado(turno.getMontoFinalDeclarado());
        dto.setTotalVentasEfectivo(turno.getTotalVentasEfectivo());
        dto.setTotalVentasTarjeta(turno.getTotalVentasTarjeta());
        dto.setTotalVentasTransferencia(turno.getTotalVentasTransferencia());
        dto.setTotalOtrosIngresos(turno.getTotalOtrosIngresos());
        dto.setTotalEgresos(turno.getTotalEgresos());
        dto.setMontoEsperado(turno.getMontoEsperado());
        dto.setDiferencia(turno.getDiferencia());
        dto.setEstado(turno.getEstado());
        dto.setObservacionApertura(turno.getObservacionApertura());
        dto.setObservacionCierre(turno.getObservacionCierre());
        dto.setFechaApertura(turno.getFechaApertura());
        dto.setFechaCierre(turno.getFechaCierre());
        dto.setFechaModificacion(turno.getFechaModificacion());

        Caja caja = turno.getCaja();
        if (caja != null) {
            dto.setIdCaja(caja.getIdCaja());
            dto.setCajaNombre(caja.getNombre());
            if (caja.getAlmacen() != null) {
                dto.setIdAlmacen(caja.getAlmacen().getIdAlmacen());
                dto.setAlmacenNombre(caja.getAlmacen().getNombre());
            }
        }

        Usuario usuarioApertura = turno.getUsuarioApertura();
        if (usuarioApertura != null) {
            dto.setIdUsuarioApertura(usuarioApertura.getIdUsuario());
            dto.setUsernameUsuarioApertura(usuarioApertura.getUsername());
        }

        Usuario usuarioCierre = turno.getUsuarioCierre();
        if (usuarioCierre != null) {
            dto.setIdUsuarioCierre(usuarioCierre.getIdUsuario());
            dto.setUsernameUsuarioCierre(usuarioCierre.getUsername());
        }

        return dto;
    }
}
