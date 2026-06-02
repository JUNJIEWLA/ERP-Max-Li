package com.maxli.caja.mapper;

import com.maxli.caja.dto.MovimientoCajaResponseDTO;
import com.maxli.caja.entity.CajaChica;
import com.maxli.caja.entity.MovimientoCaja;
import com.maxli.usuario.entity.Usuario;
import org.springframework.stereotype.Component;

@Component
public class MovimientoCajaMapper {

    public MovimientoCajaResponseDTO toDto(MovimientoCaja movimiento) {
        MovimientoCajaResponseDTO dto = new MovimientoCajaResponseDTO();
        dto.setIdMovimiento(movimiento.getIdMovimiento());
        dto.setTipoMovimiento(movimiento.getTipoMovimiento());
        dto.setFechaHora(movimiento.getFechaHora());
        dto.setMonto(movimiento.getMonto());
        dto.setConcepto(movimiento.getConcepto());

        CajaChica cajaChica = movimiento.getCajaChica();
        if (cajaChica != null) {
            dto.setIdCajaChica(cajaChica.getIdCajaChica());
            dto.setCajaChicaNombre(cajaChica.getNombre());
            dto.setSaldoActualCajaChica(cajaChica.getSaldoActual());
        }

        Usuario usuario = movimiento.getUsuario();
        if (usuario != null) {
            dto.setIdUsuario(usuario.getIdUsuario());
            dto.setUsername(usuario.getUsername());
        }

        return dto;
    }
}
