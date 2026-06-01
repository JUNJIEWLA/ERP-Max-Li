package com.maxli.caja.service;

import com.maxli.caja.dto.AbrirTurnoCajaRequestDTO;
import com.maxli.caja.dto.CerrarTurnoCajaRequestDTO;
import com.maxli.caja.dto.TurnoCajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.mapper.TurnoCajaMapper;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TurnoCajaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String ABIERTO = "ABIERTO";
    private static final String CERRADO = "CERRADO";

    private final TurnoCajaRepository turnoCajaRepository;
    private final CajaRepository cajaRepository;
    private final UsuarioRepository usuarioRepository;
    private final TurnoCajaMapper turnoCajaMapper;

    @Transactional(readOnly = true)
    public Page<TurnoCajaResponseDTO> listar(Pageable pageable) {
        return turnoCajaRepository.findAll(pageable).map(turnoCajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<TurnoCajaResponseDTO> listarAbiertos(Pageable pageable) {
        return turnoCajaRepository.findByEstado(ABIERTO, pageable).map(turnoCajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public TurnoCajaResponseDTO buscarPorId(Long id) {
        return turnoCajaMapper.toDto(obtenerPorId(id));
    }

    @Transactional(readOnly = true)
    public TurnoCajaResponseDTO buscarAbiertoPorCaja(Long idCaja) {
        return turnoCajaMapper.toDto(turnoCajaRepository.findByCaja_IdCajaAndEstado(idCaja, ABIERTO)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No hay turno abierto para la caja con id: " + idCaja)));
    }

    @Transactional(readOnly = true)
    public TurnoCajaResponseDTO buscarAbiertoPorUsuario(String username) {
        return turnoCajaMapper.toDto(turnoCajaRepository.findByUsuarioApertura_UsernameAndEstado(username, ABIERTO)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No hay turno abierto para el usuario: " + username)));
    }

    @Transactional
    public TurnoCajaResponseDTO abrir(AbrirTurnoCajaRequestDTO dto, String username) {
        Caja caja = obtenerCajaActiva(dto.getIdCaja());
        Usuario usuario = obtenerUsuarioActivo(username);

        if (turnoCajaRepository.existsByCaja_IdCajaAndEstado(dto.getIdCaja(), ABIERTO)) {
            throw new BusinessException("La caja con id " + dto.getIdCaja() + " ya tiene un turno abierto");
        }

        if (turnoCajaRepository.existsByUsuarioApertura_UsernameAndEstado(username, ABIERTO)) {
            throw new BusinessException("El usuario " + username + " ya tiene un turno abierto");
        }

        TurnoCaja turno = new TurnoCaja();
        turno.setCaja(caja);
        turno.setUsuarioApertura(usuario);
        turno.setMontoInicial(dto.getMontoInicial());
        turno.setObservacionApertura(dto.getObservacionApertura());
        turno.setEstado(ABIERTO);
        turno.setFechaApertura(LocalDateTime.now());

        return turnoCajaMapper.toDto(turnoCajaRepository.save(turno));
    }

    @Transactional
    public TurnoCajaResponseDTO cerrar(Long id, CerrarTurnoCajaRequestDTO dto, String username) {
        TurnoCaja turno = obtenerPorId(id);
        validarEstado(turno, Set.of(ABIERTO), "cerrar");

        Usuario usuarioCierre = obtenerUsuarioActivo(username);
        turno.setUsuarioCierre(usuarioCierre);
        turno.setMontoFinalDeclarado(dto.getMontoFinalDeclarado());
        turno.setObservacionCierre(dto.getObservacionCierre());
        turno.setFechaCierre(LocalDateTime.now());
        turno.setEstado(CERRADO);

        return turnoCajaMapper.toDto(turnoCajaRepository.save(turno));
    }

    public TurnoCaja obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    private TurnoCaja obtenerPorId(Long id) {
        return turnoCajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Turno de caja no encontrado con id: " + id));
    }

    private Caja obtenerCajaActiva(Long idCaja) {
        return cajaRepository.findById(idCaja)
                .filter(caja -> ACTIVO.equals(caja.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Caja no encontrada o inactiva con id: " + idCaja));
    }

    private Usuario obtenerUsuarioActivo(String username) {
        return usuarioRepository.findByUsername(username)
                .filter(usuario -> ACTIVO.equals(usuario.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado o inactivo: " + username));
    }

    private void validarEstado(TurnoCaja turno, Set<String> estadosPermitidos, String accion) {
        if (!estadosPermitidos.contains(turno.getEstado())) {
            throw new BusinessException(
                    "No se puede " + accion + " un turno en estado '" + turno.getEstado() +
                    "'. Estados permitidos: " + estadosPermitidos);
        }
    }
}
