package com.maxli.almacen.service;

import com.maxli.almacen.dto.AlmacenRequestDTO;
import com.maxli.almacen.dto.AlmacenResponseDTO;
import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.mapper.AlmacenMapper;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AlmacenService {

    private final AlmacenRepository almacenRepository;
    private final AlmacenMapper almacenMapper;

    @Transactional(readOnly = true)
    public Page<AlmacenResponseDTO> listar(Pageable pageable) {
        return almacenRepository.findAll(pageable).map(almacenMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<AlmacenResponseDTO> listarActivos(Pageable pageable) {
        return almacenRepository.findByEstado("ACTIVO", pageable).map(almacenMapper::toDto);
    }

    @Transactional(readOnly = true)
    public AlmacenResponseDTO buscarPorId(Long id) {
        return almacenMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public AlmacenResponseDTO crear(AlmacenRequestDTO dto) {
        if (almacenRepository.existsByNombreIgnoreCase(dto.getNombre().trim())) {
            throw new DuplicateResourceException(
                    "Ya existe un almacén con el nombre: " + dto.getNombre());
        }
        Almacen almacen = almacenMapper.toEntity(dto);
        return almacenMapper.toDto(almacenRepository.save(almacen));
    }

    @Transactional
    public AlmacenResponseDTO actualizar(Long id, AlmacenRequestDTO dto) {
        Almacen almacen = obtenerPorId(id);

        String nuevoNombre = dto.getNombre().trim();
        if (!almacen.getNombre().equalsIgnoreCase(nuevoNombre)
                && almacenRepository.existsByNombreIgnoreCase(nuevoNombre)) {
            throw new DuplicateResourceException(
                    "Ya existe un almacén con el nombre: " + nuevoNombre);
        }

        almacen.setNombre(nuevoNombre);
        almacen.setDescripcion(dto.getDescripcion());
        if (dto.getEstado() != null) {
            almacen.setEstado(dto.getEstado());
        }
        return almacenMapper.toDto(almacenRepository.save(almacen));
    }

    @Transactional
    public void desactivar(Long id) {
        Almacen almacen = obtenerPorId(id);
        almacen.setEstado("INACTIVO");
        almacenRepository.save(almacen);
    }

    public Almacen obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    private Almacen obtenerPorId(Long id) {
        return almacenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Almacén no encontrado con id: " + id));
    }
}
