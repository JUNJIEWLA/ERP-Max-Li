package com.maxli.compra.service;

import com.maxli.compra.dto.DetalleNotaRecepcionRequestDTO;
import com.maxli.compra.dto.NotaRecepcionRequestDTO;
import com.maxli.compra.dto.NotaRecepcionResponseDTO;
import com.maxli.compra.entity.DetalleNotaRecepcion;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.NotaRecepcion;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.mapper.NotaRecepcionMapper;
import com.maxli.compra.repository.DetalleOrdenCompraRepository;
import com.maxli.compra.repository.NotaRecepcionRepository;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotaRecepcionService {

    private static final String PENDIENTE          = "PENDIENTE";
    private static final String CONFIRMADA         = "CONFIRMADA";
    private static final String RECHAZADA          = "RECHAZADA";
    private static final String ENVIADA            = "ENVIADA";
    private static final String RECEPCION_PARCIAL  = "RECEPCION_PARCIAL";
    private static final String COMPLETADA         = "COMPLETADA";

    private final NotaRecepcionRepository notaRecepcionRepository;
    private final OrdenCompraRepository ordenCompraRepository;
    private final DetalleOrdenCompraRepository detalleOrdenCompraRepository;
    private final ExistenciaRepository existenciaRepository;
    private final OrdenCompraService ordenCompraService;
    private final NotaRecepcionMapper notaRecepcionMapper;

    @Transactional(readOnly = true)
    public Page<NotaRecepcionResponseDTO> listar(Pageable pageable) {
        return notaRecepcionRepository.findAll(pageable).map(notaRecepcionMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<NotaRecepcionResponseDTO> listarPorOrden(Long idOrdenCompra, Pageable pageable) {
        ordenCompraService.obtenerEntidadPorId(idOrdenCompra);
        return notaRecepcionRepository.findByOrdenCompra_IdOrdenCompra(idOrdenCompra, pageable)
                .map(notaRecepcionMapper::toDto);
    }

    @Transactional(readOnly = true)
    public NotaRecepcionResponseDTO buscarPorId(Long id) {
        return notaRecepcionMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public NotaRecepcionResponseDTO crear(NotaRecepcionRequestDTO dto) {
        OrdenCompra orden = ordenCompraService.obtenerEntidadPorId(dto.getIdOrdenCompra());

        if (!Set.of(ENVIADA, RECEPCION_PARCIAL).contains(orden.getEstado())) {
            throw new BusinessException(
                    "Solo se puede registrar recepción para órdenes en estado ENVIADA o RECEPCION_PARCIAL. " +
                    "Estado actual: " + orden.getEstado());
        }

        NotaRecepcion nota = new NotaRecepcion();
        nota.setOrdenCompra(orden);
        nota.setEstado(PENDIENTE);

        List<DetalleNotaRecepcion> detalles = dto.getDetalles().stream()
                .map(d -> construirDetalle(d, nota, orden))
                .toList();

        nota.getDetalles().addAll(detalles);
        return notaRecepcionMapper.toDto(notaRecepcionRepository.save(nota));
    }

    /**
     * Confirma la nota de recepción:
     * 1. Actualiza Existencia para cada ítem CONFORME.
     * 2. Acumula cantidadRecibida en DetalleOrdenCompra.
     * 3. Actualiza el estado de la OrdenCompra (RECEPCION_PARCIAL o COMPLETADA).
     */
    @Transactional
    public NotaRecepcionResponseDTO confirmar(Long id) {
        NotaRecepcion nota = obtenerPorId(id);

        if (!PENDIENTE.equals(nota.getEstado())) {
            throw new BusinessException("Solo se puede confirmar una nota en estado PENDIENTE. " +
                    "Estado actual: " + nota.getEstado());
        }

        // Procesar cada ítem de la nota
        for (DetalleNotaRecepcion detalle : nota.getDetalles()) {
            if ("CONFORME".equals(detalle.getObservacion())) {
                // 1. Actualizar stock en Existencia
                Long idProducto = detalle.getDetalleOrdenCompra().getProducto().getIdProducto();
                Existencia existencia = existenciaRepository.findByProducto_IdProducto(idProducto)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "No se encontró registro de Existencia para el producto con id: " + idProducto +
                                ". Cree el registro de existencia antes de confirmar la recepción."));

                existencia.setCantidadActual(
                        existencia.getCantidadActual() + detalle.getCantidadRecibida()
                );
                existenciaRepository.save(existencia);
            }

            // 2. Acumular en DetalleOrdenCompra (independientemente del estado físico)
            DetalleOrdenCompra detalleOrden = detalle.getDetalleOrdenCompra();
            detalleOrden.setCantidadRecibida(
                    detalleOrden.getCantidadRecibida() + detalle.getCantidadRecibida()
            );
            detalleOrdenCompraRepository.save(detalleOrden);
        }

        // 3. Actualizar estado de la nota
        nota.setEstado(CONFIRMADA);
        notaRecepcionRepository.save(nota);

        // 4. Actualizar estado de la orden según recepción total vs parcial
        actualizarEstadoOrden(nota.getOrdenCompra());

        return notaRecepcionMapper.toDto(nota);
    }

    @Transactional
    public NotaRecepcionResponseDTO rechazar(Long id) {
        NotaRecepcion nota = obtenerPorId(id);

        if (!PENDIENTE.equals(nota.getEstado())) {
            throw new BusinessException("Solo se puede rechazar una nota en estado PENDIENTE. " +
                    "Estado actual: " + nota.getEstado());
        }

        nota.setEstado(RECHAZADA);
        return notaRecepcionMapper.toDto(notaRecepcionRepository.save(nota));
    }

    // ── Privados ────────────────────────────────────────────────────────

    private NotaRecepcion obtenerPorId(Long id) {
        return notaRecepcionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Nota de recepción no encontrada con id: " + id));
    }

    private DetalleNotaRecepcion construirDetalle(DetalleNotaRecepcionRequestDTO dto,
                                                  NotaRecepcion nota,
                                                  OrdenCompra orden) {
        // Verificar que el DetalleOrdenCompra pertenece a esta orden
        DetalleOrdenCompra detalleOrden = detalleOrdenCompraRepository.findById(dto.getIdDetalleOrdenCompra())
                .filter(d -> d.getOrdenCompra().getIdOrdenCompra().equals(orden.getIdOrdenCompra()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Detalle de orden de compra no encontrado o no pertenece a esta orden: " +
                        dto.getIdDetalleOrdenCompra()));

        // Validar que la cantidad recibida no supere lo que aún falta por recibir
        int pendiente = detalleOrden.getCantidad() - detalleOrden.getCantidadRecibida();
        if (dto.getCantidadRecibida() > pendiente) {
            throw new BusinessException(
                    "La cantidad recibida (" + dto.getCantidadRecibida() + ") supera la cantidad pendiente (" +
                    pendiente + ") para el producto: " + detalleOrden.getProducto().getNombre());
        }

        DetalleNotaRecepcion detalle = new DetalleNotaRecepcion();
        detalle.setNotaRecepcion(nota);
        detalle.setDetalleOrdenCompra(detalleOrden);
        detalle.setCantidadRecibida(dto.getCantidadRecibida());
        detalle.setObservacion(dto.getObservacion());
        detalle.setNotas(dto.getNotas());
        return detalle;
    }

    /**
     * Si todos los ítems de la orden tienen cantidadRecibida >= cantidad → COMPLETADA.
     * De lo contrario → RECEPCION_PARCIAL.
     */
    private void actualizarEstadoOrden(OrdenCompra orden) {
        List<DetalleOrdenCompra> detalles = detalleOrdenCompraRepository
                .findByOrdenCompra_IdOrdenCompra(orden.getIdOrdenCompra());

        boolean todosCompletos = detalles.stream()
                .allMatch(d -> d.getCantidadRecibida() >= d.getCantidad());

        orden.setEstado(todosCompletos ? COMPLETADA : RECEPCION_PARCIAL);
        ordenCompraRepository.save(orden);
    }
}
