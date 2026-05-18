package com.maxli.caja.service;

import com.maxli.caja.dto.CajaRequestDTO;
import com.maxli.caja.dto.CajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.mapper.CajaMapper;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CajaService {

    private final CajaRepository cajaRepository;
    private final CajaMapper cajaMapper;

    @Transactional(readOnly = true)
    public Page<CajaResponseDTO> listar(Pageable pageable) {
        return cajaRepository.findAll(pageable).map(cajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<CajaResponseDTO> listarActivas(Pageable pageable) {
        return cajaRepository.findByEstado("ACTIVO", pageable).map(cajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public CajaResponseDTO buscarPorId(Long id) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        return cajaMapper.toDto(caja);
    }

    @Transactional
    public CajaResponseDTO crear(CajaRequestDTO dto) {
        Caja caja = cajaMapper.toEntity(dto);
        return cajaMapper.toDto(cajaRepository.save(caja));
    }

    @Transactional
    public CajaResponseDTO actualizar(Long id, CajaRequestDTO dto) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        caja.setNombre(dto.getNombre());
        if (dto.getEstado() != null) {
            caja.setEstado(dto.getEstado());
        }
        return cajaMapper.toDto(cajaRepository.save(caja));
    }

    @Transactional
    public void desactivar(Long id) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        caja.setEstado("INACTIVO");
        cajaRepository.save(caja);
    }
}
