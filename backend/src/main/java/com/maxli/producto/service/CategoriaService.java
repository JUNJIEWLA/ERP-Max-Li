package com.maxli.producto.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.CategoriaRequestDTO;
import com.maxli.producto.dto.CategoriaResponseDTO;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.mapper.CategoriaMapper;
import com.maxli.producto.repository.CategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CategoriaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final CategoriaRepository categoriaRepository;
    private final CategoriaMapper categoriaMapper;

    @Transactional(readOnly = true)
    public Page<CategoriaResponseDTO> listar(Pageable pageable) {
        return categoriaRepository.findAll(pageable).map(categoriaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<CategoriaResponseDTO> listarActivas(Pageable pageable) {
        return categoriaRepository.findByEstado(ACTIVO, pageable).map(categoriaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public CategoriaResponseDTO buscarPorId(Long id) {
        Categoria categoria = obtenerPorId(id);
        return categoriaMapper.toDto(categoria);
    }

    @Transactional
    public CategoriaResponseDTO crear(CategoriaRequestDTO dto) {
        validarNombreDisponible(dto.getNombre());
        Categoria categoria = categoriaMapper.toEntity(dto);
        return categoriaMapper.toDto(categoriaRepository.save(categoria));
    }

    @Transactional
    public CategoriaResponseDTO actualizar(Long id, CategoriaRequestDTO dto) {
        Categoria categoria = obtenerPorId(id);
        validarNombreDisponibleParaActualizar(dto.getNombre(), id);
        categoria.setNombre(dto.getNombre());
        categoria.setDescripcion(dto.getDescripcion());
        if (dto.getEstado() != null) {
            categoria.setEstado(dto.getEstado());
        }
        return categoriaMapper.toDto(categoriaRepository.save(categoria));
    }

    @Transactional
    public void desactivar(Long id) {
        Categoria categoria = obtenerPorId(id);
        categoria.setEstado(INACTIVO);
        categoriaRepository.save(categoria);
    }

    private Categoria obtenerPorId(Long id) {
        return categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria no encontrada con id: " + id));
    }

    private void validarNombreDisponible(String nombre) {
        if (categoriaRepository.existsByNombre(nombre)) {
            throw new DuplicateResourceException("Ya existe una categoria con nombre: " + nombre);
        }
    }

    private void validarNombreDisponibleParaActualizar(String nombre, Long idCategoria) {
        if (categoriaRepository.existsByNombreAndIdCategoriaNot(nombre, idCategoria)) {
            throw new DuplicateResourceException("Ya existe una categoria con nombre: " + nombre);
        }
    }
}
