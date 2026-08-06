package com.maxli.empaque.service;

import com.maxli.empaque.dto.EmpaqueRequestDTO;
import com.maxli.empaque.dto.EmpaqueResponseDTO;
import com.maxli.empaque.entity.Empaque;
import com.maxli.empaque.repository.EmpaqueRepository;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmpaqueService {

    private final EmpaqueRepository empaqueRepository;

    @Transactional(readOnly = true)
    public List<EmpaqueResponseDTO> listarTodos() {
        return empaqueRepository.findAllByOrderByCantidadAsc()
                .stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<EmpaqueResponseDTO> listarActivos() {
        return empaqueRepository.findByEstadoOrderByCantidadAsc("ACTIVO")
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    public EmpaqueResponseDTO crear(EmpaqueRequestDTO dto) {
        if (empaqueRepository.existsByNombre(dto.getNombre().trim())) {
            throw new DuplicateResourceException("Ya existe un empaque con el nombre: " + dto.getNombre());
        }
        Empaque e = new Empaque();
        e.setNombre(dto.getNombre().trim());
        e.setCantidad(dto.getCantidad());
        e.setDescripcion(dto.getDescripcion());
        e.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return toDTO(empaqueRepository.save(e));
    }

    @Transactional
    public EmpaqueResponseDTO actualizar(Long id, EmpaqueRequestDTO dto) {
        Empaque e = empaqueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empaque no encontrado con id: " + id));
        if (empaqueRepository.existsByNombreAndIdEmpaqueNot(dto.getNombre().trim(), id)) {
            throw new DuplicateResourceException("Ya existe un empaque con el nombre: " + dto.getNombre());
        }
        e.setNombre(dto.getNombre().trim());
        e.setCantidad(dto.getCantidad());
        e.setDescripcion(dto.getDescripcion());
        if (dto.getEstado() != null) e.setEstado(dto.getEstado());
        return toDTO(empaqueRepository.save(e));
    }

    @Transactional
    public void eliminar(Long id) {
        Empaque e = empaqueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empaque no encontrado con id: " + id));
        e.setEstado("INACTIVO");
        empaqueRepository.save(e);
    }

    private EmpaqueResponseDTO toDTO(Empaque e) {
        EmpaqueResponseDTO dto = new EmpaqueResponseDTO();
        dto.setIdEmpaque(e.getIdEmpaque());
        dto.setNombre(e.getNombre());
        dto.setCantidad(e.getCantidad());
        dto.setDescripcion(e.getDescripcion());
        dto.setEstado(e.getEstado());
        dto.setFechaCreacion(e.getFechaCreacion());
        dto.setFechaModificacion(e.getFechaModificacion());
        return dto;
    }
}
