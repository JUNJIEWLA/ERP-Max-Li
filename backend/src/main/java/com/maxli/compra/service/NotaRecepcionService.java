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
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.existencia.service.ExistenciaLockService.ClaveExistencia;
import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.producto.entity.AlertaCosto;
import com.maxli.producto.entity.HistorialCosto;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.AlertaCostoRepository;
import com.maxli.producto.repository.HistorialCostoRepository;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
    private final ExistenciaLockService existenciaLockService;
    private final AlmacenRepository almacenRepository;
    private final ProductoRepository productoRepository;
    private final HistorialCostoRepository historialCostoRepository;
    private final AlertaCostoRepository alertaCostoRepository;
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
     * Confirma la nota de recepción. Ejecuta las siguientes tareas en cadena
     * dentro de una misma transacción:
     *
     * 1. Incrementa Existencia por cada ítem con cantidadRecibida > 0.
     * 2. Acumula cantidadRecibida en DetalleOrdenCompra.
     * 3. Registra el historial de costo (costo viejo → costo nuevo).
     * 4. Actualiza producto.costo con el precioUnitario de la orden (última compra).
     * 5. Si el costo cambió, genera una AlertaCosto en el buzón con precio sugerido.
     * 6. Actualiza el estado de la OrdenCompra.
     */
    @Transactional
    public NotaRecepcionResponseDTO confirmar(Long id) {
        NotaRecepcion nota = obtenerPorId(id);

        if (!PENDIENTE.equals(nota.getEstado())) {
            throw new BusinessException("Solo se puede confirmar una nota en estado PENDIENTE. " +
                    "Estado actual: " + nota.getEstado());
        }

        OrdenCompra orden = nota.getOrdenCompra();

        // Bloquear todas las existencias que esta recepción incrementará antes
        // de leerlas. Las ausentes se crean con ON CONFLICT y luego se bloquean.
        List<ClaveExistencia> clavesExistencia = nota.getDetalles().stream()
                .filter(detalle -> detalle.getCantidadRecibida() > 0)
                .peek(detalle -> validarAlmacenDestino(detalle.getAlmacen()))
                .map(detalle -> new ClaveExistencia(
                        detalle.getDetalleOrdenCompra().getProducto().getIdProducto(),
                        detalle.getAlmacen().getIdAlmacen()))
                .toList();
        Map<ClaveExistencia, Existencia> existenciasBloqueadas =
                existenciaLockService.bloquearOCrearEnOrden(clavesExistencia);

        for (DetalleNotaRecepcion detalle : nota.getDetalles()) {
            int cantidadRecibida = detalle.getCantidadRecibida();

            // Solo procesamos ítems que realmente llegaron (cantidad > 0)
            if (cantidadRecibida > 0) {
                DetalleOrdenCompra detalleOrden = detalle.getDetalleOrdenCompra();
                Producto producto = detalleOrden.getProducto();
                Long idProducto = producto.getIdProducto();

                Almacen almacenDestino = detalle.getAlmacen();

                // 1. Incrementar una existencia ya bloqueada para este par exacto.
                Existencia existencia = existenciasBloqueadas.get(
                        new ClaveExistencia(idProducto, almacenDestino.getIdAlmacen()));

                existencia.setCantidadActual(existencia.getCantidadActual() + cantidadRecibida);

                // 2. Acumular en DetalleOrdenCompra
                detalleOrden.setCantidadRecibida(detalleOrden.getCantidadRecibida() + cantidadRecibida);
                detalleOrdenCompraRepository.save(detalleOrden);

                // 3. Registrar historial de costo
                BigDecimal costoAnterior = producto.getCosto();
                BigDecimal costoNuevo = detalleOrden.getPrecioUnitario();

                HistorialCosto historial = new HistorialCosto();
                historial.setProducto(producto);
                historial.setNotaRecepcion(nota);
                historial.setProveedor(orden.getProveedor());
                historial.setCostoAnterior(costoAnterior);
                historial.setCostoNuevo(costoNuevo);
                historial.setCantidadRecibida(cantidadRecibida);
                historial.setFechaRegistro(LocalDateTime.now());
                historialCostoRepository.save(historial);

                // 4. Actualizar costo del producto (lógica de última compra)
                producto.setCosto(costoNuevo);
                productoRepository.save(producto);

                // 5. Si el costo cambió, generar alerta en el buzón
                if (costoAnterior.compareTo(costoNuevo) != 0) {
                    generarAlertaCosto(producto, nota, costoAnterior, costoNuevo);
                }
            }
        }

        // 6. Marcar la nota como confirmada
        nota.setEstado(CONFIRMADA);
        notaRecepcionRepository.save(nota);

        // 7. Actualizar estado de la orden (COMPLETADA o RECEPCION_PARCIAL)
        actualizarEstadoOrden(orden);

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

        if (dto.getIdAlmacen() == null) {
            throw new BusinessException("El almacén es obligatorio.");
        }
        Almacen almacen = almacenRepository.findById(dto.getIdAlmacen())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Almacén no encontrado con id: " + dto.getIdAlmacen()));
        if (!"ACTIVO".equals(almacen.getEstado())) {
            throw new BusinessException("El almacén con id " + dto.getIdAlmacen() + " está inactivo");
        }

        DetalleNotaRecepcion detalle = new DetalleNotaRecepcion();
        detalle.setNotaRecepcion(nota);
        detalle.setDetalleOrdenCompra(detalleOrden);
        detalle.setCantidadRecibida(dto.getCantidadRecibida());
        detalle.setObservacion(dto.getObservacion());
        detalle.setNotas(dto.getNotas());
        detalle.setAlmacen(almacen);
        return detalle;
    }

    private void validarAlmacenDestino(Almacen almacenDestino) {
        if (almacenDestino == null) {
            throw new BusinessException("El almacén de destino no está definido en el detalle de la nota de recepción.");
        }
        if (!"ACTIVO".equals(almacenDestino.getEstado())) {
            throw new BusinessException("El almacén de destino '" + almacenDestino.getNombre() + "' está inactivo.");
        }
    }

    /**
     * Genera una alerta de costo persistente en el buzón.
     * Calcula el precio sugerido usando el margen de la categoría del producto.
     */
    private void generarAlertaCosto(Producto producto, NotaRecepcion nota,
                                     BigDecimal costoAnterior, BigDecimal costoNuevo) {
        BigDecimal margen = producto.getCategoria().getPorcentajeMargen();

        // Precio sugerido detalle = costoNuevo × (1 + margen/100)
        BigDecimal multiplicador = BigDecimal.ONE.add(
                margen.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        BigDecimal precioSugerido = costoNuevo.multiply(multiplicador).setScale(2, RoundingMode.HALF_UP);

        // Precio sugerido mayorista
        BigDecimal margenMayor = producto.getCategoria().getPorcentajeMargenMayor();
        BigDecimal precioMayorSugerido = null;
        if (margenMayor != null && margenMayor.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal multiplicadorMayor = BigDecimal.ONE.add(
                    margenMayor.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
            precioMayorSugerido = costoNuevo.multiply(multiplicadorMayor).setScale(2, RoundingMode.HALF_UP);
        }

        // Variación porcentual: ((costoNuevo - costoAnterior) / costoAnterior) × 100
        BigDecimal variacion = BigDecimal.ZERO;
        if (costoAnterior.compareTo(BigDecimal.ZERO) > 0) {
            variacion = costoNuevo.subtract(costoAnterior)
                    .divide(costoAnterior, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        AlertaCosto alerta = new AlertaCosto();
        alerta.setProducto(producto);
        alerta.setNotaRecepcion(nota);
        alerta.setNombreProducto(producto.getNombre());
        alerta.setCostoAnterior(costoAnterior);
        alerta.setCostoNuevo(costoNuevo);
        alerta.setPrecioVentaActual(producto.getPrecioVenta());
        alerta.setPrecioVentaSugerido(precioSugerido);
        alerta.setPrecioVentaMayorActual(producto.getPrecioVentaMayor());
        alerta.setPrecioVentaMayorSugerido(precioMayorSugerido);
        alerta.setPorcentajeVariacion(variacion);
        alerta.setPorcentajeMargen(margen);
        alerta.setPorcentajeMargenMayor(margenMayor);
        alerta.setEstado("PENDIENTE");
        alerta.setFechaCreacion(LocalDateTime.now());

        alertaCostoRepository.save(alerta);
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
