package com.maxli.existencia.service;

import com.maxli.almacen.service.AlmacenService;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import java.util.List;
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
    private final ExistenciaLockService existenciaLockService;
    private final ProductoRepository productoRepository;
    private final AlmacenService almacenService;
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
    public List<ExistenciaResponseDTO> buscarPorProducto(Long idProducto) {
        return existenciaRepository.findByProducto_IdProducto(idProducto).stream()
                .map(existenciaMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ExistenciaResponseDTO> listarBajoStock(Pageable pageable) {
        return existenciaRepository.findBajoStock(pageable).map(existenciaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ExistenciaResponseDTO> listarPorAlmacen(Long idAlmacen, Pageable pageable) {
        return existenciaRepository.findByAlmacen_IdAlmacen(idAlmacen, pageable).map(existenciaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ExistenciaResponseDTO> listarBajoStockPorAlmacen(Long idAlmacen, Pageable pageable) {
        return existenciaRepository.findBajoStockByAlmacen(idAlmacen, pageable).map(existenciaMapper::toDto);
    }

    @Transactional
    public ExistenciaResponseDTO crear(ExistenciaRequestDTO dto) {
        Producto producto = obtenerProductoActivo(dto.getIdProducto());
        var almacen = almacenService.obtenerEntidadPorId(dto.getIdAlmacen());
        if (!existenciaLockService.crearManualSiAusente(dto.getIdProducto(), dto.getIdAlmacen(),
                dto.getCantidadActual(), dto.getCantidadMinima())) {
            throw new DuplicateResourceException(
                    "Ya existe un registro de existencia para este producto en este almacén");
        }
        Existencia existencia = existenciaLockService.bloquear(dto.getIdProducto(), dto.getIdAlmacen())
                .orElseThrow();
        return existenciaMapper.toDto(existencia);
    }

    @Transactional
    public ExistenciaResponseDTO actualizar(Long id, ExistenciaRequestDTO dto) {
        if (dto.getDeltaCantidadActual() == null) {
            throw new BusinessException("El ajuste de stock requiere deltaCantidadActual");
        }
        Existencia existencia = obtenerPorIdBloqueada(id);
        int nuevaCantidad = existencia.getCantidadActual() + dto.getDeltaCantidadActual();
        if (nuevaCantidad < 0) {
            throw new BusinessException("El ajuste deja el stock negativo");
        }
        existencia.setCantidadActual(nuevaCantidad);
        existencia.setCantidadMinima(dto.getCantidadMinima());
        return existenciaMapper.toDto(existenciaRepository.save(existencia));
    }

    private Existencia obtenerPorId(Long id) {
        return existenciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Existencia no encontrada con id: " + id));
    }

    private Existencia obtenerPorIdBloqueada(Long id) {
        return existenciaLockService.bloquearPorId(id)
                .orElseThrow(() -> new ResourceNotFoundException("Existencia no encontrada con id: " + id));
    }

    private Producto obtenerProductoActivo(Long idProducto) {
        return productoRepository.findById(idProducto)
                .filter(p -> "ACTIVO".equals(p.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado o inactivo con id: " + idProducto));
    }

}
