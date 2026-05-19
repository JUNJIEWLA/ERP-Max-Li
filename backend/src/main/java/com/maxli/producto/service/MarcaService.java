package com.maxli.producto.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.MarcaRequestDTO;
import com.maxli.producto.dto.MarcaResponseDTO;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.mapper.MarcaMapper;
import com.maxli.producto.repository.MarcaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MarcaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final MarcaRepository marcaRepository;
    private final MarcaMapper marcaMapper;

    @Transactional(readOnly = true)
    public Page<MarcaResponseDTO> listar(Pageable pageable) {
        return marcaRepository.findAll(pageable).map(marcaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<MarcaResponseDTO> listarActivas(Pageable pageable) {
        return marcaRepository.findByEstado(ACTIVO, pageable).map(marcaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public MarcaResponseDTO buscarPorId(Long id) {
        Marca marca = obtenerPorId(id);
        return marcaMapper.toDto(marca);
    }

    @Transactional
    public MarcaResponseDTO crear(MarcaRequestDTO dto) {
        validarNombreDisponible(dto.getNombre());
        Marca marca = marcaMapper.toEntity(dto);
        return marcaMapper.toDto(marcaRepository.save(marca));
    }

    @Transactional
    public MarcaResponseDTO actualizar(Long id, MarcaRequestDTO dto) {
        Marca marca = obtenerPorId(id);
        validarNombreDisponibleParaActualizar(dto.getNombre(), id);
        marca.setNombre(dto.getNombre());
        marca.setDescripcion(dto.getDescripcion());
        if (dto.getEstado() != null) {
            marca.setEstado(dto.getEstado());
        }
        return marcaMapper.toDto(marcaRepository.save(marca));
    }

    @Transactional
    public void desactivar(Long id) {
        Marca marca = obtenerPorId(id);
        marca.setEstado(INACTIVO);
        marcaRepository.save(marca);
    }

    private Marca obtenerPorId(Long id) {
        return marcaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Marca no encontrada con id: " + id));
    }

    private void validarNombreDisponible(String nombre) {
        if (marcaRepository.existsByNombre(nombre)) {
            throw new DuplicateResourceException("Ya existe una marca con nombre: " + nombre);
        }
    }

    private void validarNombreDisponibleParaActualizar(String nombre, Long idMarca) {
        if (marcaRepository.existsByNombreAndIdMarcaNot(nombre, idMarca)) {
            throw new DuplicateResourceException("Ya existe una marca con nombre: " + nombre);
        }
    }
}
