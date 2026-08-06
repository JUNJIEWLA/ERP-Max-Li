package com.maxli.producto.service;

import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.AlertaCostoResponseDTO;
import com.maxli.producto.entity.AlertaCosto;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.mapper.AlertaCostoMapper;
import com.maxli.producto.repository.AlertaCostoRepository;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertaCostoService {

    private static final String PENDIENTE = "PENDIENTE";
    private static final String APLICADA = "APLICADA";
    private static final String DESCARTADA = "DESCARTADA";

    private final AlertaCostoRepository alertaCostoRepository;
    private final ProductoRepository productoRepository;
    private final AlertaCostoMapper alertaCostoMapper;

    @Transactional(readOnly = true)
    public Page<AlertaCostoResponseDTO> listarPendientes(Pageable pageable) {
        return alertaCostoRepository.findByEstadoOrderByFechaCreacionDesc(PENDIENTE, pageable)
                .map(alertaCostoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public long contarPendientes() {
        return alertaCostoRepository.countByEstado(PENDIENTE);
    }

    /**
     * Aplica masivamente los precios sugeridos:
     * - Actualiza producto.precioVenta con el precioVentaSugerido de cada alerta
     * - Marca las alertas como APLICADA
     */
    @Transactional
    public List<AlertaCostoResponseDTO> aplicarMasivo(List<Long> ids) {
        List<AlertaCosto> alertas = alertaCostoRepository.findByIdAlertaCostoIn(ids);

        if (alertas.isEmpty()) {
            throw new ResourceNotFoundException("No se encontraron alertas con los IDs proporcionados");
        }

        for (AlertaCosto alerta : alertas) {
            if (!PENDIENTE.equals(alerta.getEstado())) {
                throw new BusinessException("La alerta #" + alerta.getIdAlertaCosto() +
                        " no está en estado PENDIENTE. Estado actual: " + alerta.getEstado());
            }

            // Actualizar precio de venta del producto
            Producto producto = productoRepository.findById(alerta.getProducto().getIdProducto())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + alerta.getProducto().getIdProducto()));
            producto.setPrecioVenta(alerta.getPrecioVentaSugerido());
            // También actualizar precio mayorista si existe sugerencia
            if (alerta.getPrecioVentaMayorSugerido() != null) {
                producto.setPrecioVentaMayor(alerta.getPrecioVentaMayorSugerido());
            }
            productoRepository.save(producto);

            // Marcar alerta como aplicada
            alerta.setEstado(APLICADA);
            alerta.setFechaResolucion(LocalDateTime.now());
        }

        alertaCostoRepository.saveAll(alertas);
        return alertas.stream().map(alertaCostoMapper::toDto).toList();
    }

    /**
     * Descarta masivamente las alertas seleccionadas.
     * No modifica el precio del producto.
     */
    @Transactional
    public List<AlertaCostoResponseDTO> descartarMasivo(List<Long> ids) {
        List<AlertaCosto> alertas = alertaCostoRepository.findByIdAlertaCostoIn(ids);

        if (alertas.isEmpty()) {
            throw new ResourceNotFoundException("No se encontraron alertas con los IDs proporcionados");
        }

        for (AlertaCosto alerta : alertas) {
            if (!PENDIENTE.equals(alerta.getEstado())) {
                throw new BusinessException("La alerta #" + alerta.getIdAlertaCosto() +
                        " no está en estado PENDIENTE. Estado actual: " + alerta.getEstado());
            }
            alerta.setEstado(DESCARTADA);
            alerta.setFechaResolucion(LocalDateTime.now());
        }

        alertaCostoRepository.saveAll(alertas);
        return alertas.stream().map(alertaCostoMapper::toDto).toList();
    }
}
