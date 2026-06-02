package com.maxli.caja.service;

import com.maxli.caja.dto.CajaChicaRequestDTO;
import com.maxli.caja.dto.CajaChicaResponseDTO;
import com.maxli.caja.entity.CajaChica;
import com.maxli.caja.mapper.CajaChicaMapper;
import com.maxli.caja.repository.CajaChicaRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class CajaChicaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final CajaChicaRepository cajaChicaRepository;
    private final CajaChicaMapper cajaChicaMapper;

    @Transactional(readOnly = true)
    public Page<CajaChicaResponseDTO> listar(Pageable pageable) {
        return cajaChicaRepository.findAll(pageable).map(cajaChicaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<CajaChicaResponseDTO> listarActivas(Pageable pageable) {
        return cajaChicaRepository.findByEstado(ACTIVO, pageable).map(cajaChicaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public CajaChicaResponseDTO buscarPorId(Long id) {
        return cajaChicaMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public CajaChicaResponseDTO crear(CajaChicaRequestDTO dto) {
        if (cajaChicaRepository.existsByNombre(dto.getNombre())) {
            throw new DuplicateResourceException("Ya existe una caja chica con el nombre: " + dto.getNombre());
        }
        validarSaldoDentroLimite(dto.getSaldoActual(), dto.getLimiteMonto());

        CajaChica cajaChica = cajaChicaMapper.toEntity(dto);
        return cajaChicaMapper.toDto(cajaChicaRepository.save(cajaChica));
    }

    @Transactional
    public CajaChicaResponseDTO actualizar(Long id, CajaChicaRequestDTO dto) {
        CajaChica cajaChica = obtenerPorId(id);

        if (cajaChicaRepository.existsByNombreAndIdCajaChicaNot(dto.getNombre(), id)) {
            throw new DuplicateResourceException("Ya existe otra caja chica con el nombre: " + dto.getNombre());
        }
        validarSaldoDentroLimite(dto.getSaldoActual(), dto.getLimiteMonto());

        cajaChica.setNombre(dto.getNombre());
        cajaChica.setResponsable(dto.getResponsable());
        cajaChica.setSaldoActual(dto.getSaldoActual());
        cajaChica.setLimiteMonto(dto.getLimiteMonto());
        if (dto.getEstado() != null) {
            cajaChica.setEstado(dto.getEstado());
        }

        return cajaChicaMapper.toDto(cajaChicaRepository.save(cajaChica));
    }

    @Transactional
    public void desactivar(Long id) {
        CajaChica cajaChica = obtenerPorId(id);
        cajaChica.setEstado(INACTIVO);
        cajaChicaRepository.save(cajaChica);
    }

    public CajaChica obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    private CajaChica obtenerPorId(Long id) {
        return cajaChicaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja chica no encontrada con id: " + id));
    }

    private void validarSaldoDentroLimite(BigDecimal saldoActual, BigDecimal limiteMonto) {
        if (saldoActual.compareTo(limiteMonto) > 0) {
            throw new BusinessException("El saldo actual no puede superar el limite de la caja chica");
        }
    }
}
