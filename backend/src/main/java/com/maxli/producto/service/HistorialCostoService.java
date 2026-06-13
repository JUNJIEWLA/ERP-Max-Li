package com.maxli.producto.service;

import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.HistorialCostoResponseDTO;
import com.maxli.producto.mapper.HistorialCostoMapper;
import com.maxli.producto.repository.HistorialCostoRepository;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HistorialCostoService {

    private final HistorialCostoRepository historialCostoRepository;
    private final ProductoRepository productoRepository;
    private final HistorialCostoMapper historialCostoMapper;

    @Transactional(readOnly = true)
    public Page<HistorialCostoResponseDTO> listarPorProducto(Long idProducto, Pageable pageable) {
        if (!productoRepository.existsById(idProducto)) {
            throw new ResourceNotFoundException("Producto no encontrado con id: " + idProducto);
        }
        return historialCostoRepository.findByProducto_IdProductoOrderByFechaRegistroDesc(idProducto, pageable)
                .map(historialCostoMapper::toDto);
    }
}
