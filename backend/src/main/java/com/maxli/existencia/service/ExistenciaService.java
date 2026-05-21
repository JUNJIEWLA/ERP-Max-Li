package com.maxli.existencia.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.dto.ExistenciaRequestDTO;
import com.maxli.existencia.dto.ExistenciaResponseDTO;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.mapper.ExistenciaMapper;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExistenciaService {

    private final ExistenciaRepository existenciaRepository;
    private final ProductoRepository productoRepository;
    private final ExistenciaMapper existenciaMapper;

    @Transactional(readOnly = true)
    public Page<ExistenciaResponseDTO> listar(Pageable pageable) {
        return existenciaRepository.findAll(pageable).map(existenciaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public ExistenciaResponseDTO buscarPorId(Long id) {
        return existenciaMapper.toDto(obtenerPorId(id));
    }

    @Transactional(readOnly = true)
    public ExistenciaResponseDTO buscarPorProducto(Long idProducto) {
        Existencia existencia = existenciaRepository.findByProducto_IdProducto(idProducto)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No existe registro de existencia para el producto con id: " + idProducto));
        return existenciaMapper.toDto(existencia);
    }

    @Transactional(readOnly = true)
    public Page<ExistenciaResponseDTO> listarBajoStock(Pageable pageable) {
        return existenciaRepository.findBajoStock(pageable).map(existenciaMapper::toDto);
    }

    @Transactional
    public ExistenciaResponseDTO crear(ExistenciaRequestDTO dto) {
        Producto producto = obtenerProductoActivo(dto.getIdProducto());
        validarExistenciaUnica(dto.getIdProducto());
        Existencia existencia = existenciaMapper.toEntity(dto, producto);
        return existenciaMapper.toDto(existenciaRepository.save(existencia));
    }

    @Transactional
    public ExistenciaResponseDTO actualizar(Long id, ExistenciaRequestDTO dto) {
        Existencia existencia = obtenerPorId(id);
        existencia.setCantidadActual(dto.getCantidadActual());
        existencia.setCantidadMinima(dto.getCantidadMinima());
        return existenciaMapper.toDto(existenciaRepository.save(existencia));
    }

    private Existencia obtenerPorId(Long id) {
        return existenciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Existencia no encontrada con id: " + id));
    }

    private Producto obtenerProductoActivo(Long idProducto) {
        return productoRepository.findById(idProducto)
                .filter(p -> "ACTIVO".equals(p.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado o inactivo con id: " + idProducto));
    }

    private void validarExistenciaUnica(Long idProducto) {
        if (existenciaRepository.existsByProducto_IdProducto(idProducto)) {
            throw new DuplicateResourceException(
                    "Ya existe un registro de existencia para el producto con id: " + idProducto);
        }
    }
}
