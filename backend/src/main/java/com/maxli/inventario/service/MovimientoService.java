package com.maxli.inventario.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.service.AlmacenService;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.existencia.service.ExistenciaLockService.ClaveExistencia;
import com.maxli.inventario.dto.DetalleMovimientoRequestDTO;
import com.maxli.inventario.dto.MovimientoRequestDTO;
import com.maxli.inventario.dto.MovimientoResponseDTO;
import com.maxli.inventario.entity.DetalleMovimiento;
import com.maxli.inventario.entity.Movimiento;
import com.maxli.inventario.mapper.MovimientoMapper;
import com.maxli.inventario.repository.MovimientoRepository;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class MovimientoService {

    private final MovimientoRepository movimientoRepository;
    private final ExistenciaLockService existenciaLockService;
    private final ProductoRepository productoRepository;
    private final AlmacenService almacenService;
    private final MovimientoMapper movimientoMapper;

    @Transactional(readOnly = true)
    public Page<MovimientoResponseDTO> listar(Pageable pageable) {
        return movimientoRepository.findAll(pageable).map(movimientoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public MovimientoResponseDTO buscarPorId(Long id) {
        return movimientoMapper.toDto(obtenerPorId(id));
    }

    @Transactional(readOnly = true)
    public Page<MovimientoResponseDTO> listarPorAlmacen(Long idAlmacen, Pageable pageable) {
        return movimientoRepository.findByAlmacen(idAlmacen, pageable).map(movimientoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<MovimientoResponseDTO> listarPorTipo(String tipo, Pageable pageable) {
        return movimientoRepository.findByTipo(tipo, pageable).map(movimientoMapper::toDto);
    }

    /**
     * Crea una transferencia de inventario entre dos almacenes.
     * <p>
     * Operación atómica: si algún producto no tiene stock suficiente en el
     * almacén de origen, se revierte toda la transacción.
     * </p>
     */
    @Transactional
    public MovimientoResponseDTO crearTransferencia(MovimientoRequestDTO dto) {
        // 1. Validar que origen y destino son distintos
        if (dto.getIdAlmacenOrigen().equals(dto.getIdAlmacenDestino())) {
            throw new BusinessException("El almacén de origen y destino no pueden ser el mismo");
        }

        // 2. Obtener y validar almacenes (deben estar activos)
        Almacen almacenOrigen = almacenService.obtenerEntidadPorId(dto.getIdAlmacenOrigen());
        Almacen almacenDestino = almacenService.obtenerEntidadPorId(dto.getIdAlmacenDestino());

        validarAlmacenActivo(almacenOrigen);
        validarAlmacenActivo(almacenDestino);

        // 3. Construir la cabecera del movimiento
        Movimiento movimiento = new Movimiento();
        movimiento.setTipo("TRANSFERENCIA");
        movimiento.setAlmacenOrigen(almacenOrigen);
        movimiento.setAlmacenDestino(almacenDestino);
        movimiento.setReferencia(dto.getReferencia());
        movimiento.setObservacion(dto.getObservacion());
        movimiento.setEstado("COMPLETADO");
        movimiento.setUsuarioResponsable(obtenerUsuarioActual());
        movimiento.setFechaMovimiento(LocalDateTime.now());

        Map<Long, Integer> cantidades = new TreeMap<>();
        for (DetalleMovimientoRequestDTO detalleDto : dto.getDetalles()) {
            cantidades.merge(detalleDto.getIdProducto(), detalleDto.getCantidad(), Integer::sum);
        }
        Map<Long, Producto> productos = new LinkedHashMap<>();
        for (Long idProducto : cantidades.keySet()) {
            productos.put(idProducto, obtenerProductoActivo(idProducto));
        }

        // Se bloquean todas las filas de origen y destino por (almacén, producto)
        // antes de leerlas. El mismo orden global evita deadlocks en transferencias
        // con origen/destino invertidos.
        Map<ClaveExistencia, Existencia> existencias = new LinkedHashMap<>();
        cantidades.keySet().stream()
                .flatMap(idProducto -> java.util.stream.Stream.of(
                        new ClaveExistencia(idProducto, dto.getIdAlmacenOrigen()),
                        new ClaveExistencia(idProducto, dto.getIdAlmacenDestino())))
                .sorted(Comparator.comparing(ClaveExistencia::idAlmacen)
                        .thenComparing(ClaveExistencia::idProducto))
                .forEach(clave -> {
                    boolean esDestino = clave.idAlmacen().equals(dto.getIdAlmacenDestino());
                    Existencia existencia = esDestino
                            ? existenciaLockService.obtenerOCrearBloqueada(clave.idProducto(), clave.idAlmacen())
                            : existenciaLockService.bloquear(clave.idProducto(), clave.idAlmacen()).orElse(null);
                    existencias.put(clave, existencia);
                });

        for (Map.Entry<Long, Integer> item : cantidades.entrySet()) {
            Long idProducto = item.getKey();
            int cantidad = item.getValue();
            Producto producto = productos.get(idProducto);
            Existencia existenciaOrigen = existencias.get(new ClaveExistencia(idProducto, dto.getIdAlmacenOrigen()));
            if (existenciaOrigen == null) {
                throw new BusinessException("El producto '" + producto.getNombre() +
                        "' no tiene registro de existencia en el almacén '" + almacenOrigen.getNombre() + "'");
            }
            if (existenciaOrigen.getCantidadActual() < cantidad) {
                throw new BusinessException("Stock insuficiente para el producto '" + producto.getNombre() +
                        "' en '" + almacenOrigen.getNombre() + "'. Disponible: " +
                        existenciaOrigen.getCantidadActual() + ", solicitado: " + cantidad);
            }
        }

        // 4. Modificar únicamente después de validar todas las líneas bloqueadas.
        for (Map.Entry<Long, Integer> item : cantidades.entrySet()) {
            Long idProducto = item.getKey();
            int cantidad = item.getValue();
            Producto producto = productos.get(idProducto);
            Existencia existenciaOrigen = existencias.get(new ClaveExistencia(idProducto, dto.getIdAlmacenOrigen()));
            Existencia existenciaDestino = existencias.get(new ClaveExistencia(idProducto, dto.getIdAlmacenDestino()));
            existenciaOrigen.setCantidadActual(existenciaOrigen.getCantidadActual() - cantidad);
            existenciaDestino.setCantidadActual(existenciaDestino.getCantidadActual() + cantidad);

            // 4c. Crear la línea de detalle del movimiento
            DetalleMovimiento detalle = new DetalleMovimiento();
            detalle.setMovimiento(movimiento);
            detalle.setProducto(producto);
            detalle.setCantidad(cantidad);
            movimiento.getDetalles().add(detalle);
        }

        // 5. Guardar movimiento (cascade guarda los detalles)
        Movimiento guardado = movimientoRepository.save(movimiento);
        return movimientoMapper.toDto(guardado);
    }

    // ── Métodos auxiliares ────────────────────────────────────

    private Movimiento obtenerPorId(Long id) {
        return movimientoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Movimiento no encontrado con id: " + id));
    }

    private Producto obtenerProductoActivo(Long idProducto) {
        return productoRepository.findById(idProducto)
                .filter(p -> "ACTIVO".equals(p.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado o inactivo con id: " + idProducto));
    }

    private void validarAlmacenActivo(Almacen almacen) {
        if (!"ACTIVO".equals(almacen.getEstado())) {
            throw new BusinessException(
                    "El almacén '" + almacen.getNombre() + "' no está activo");
        }
    }

    private String obtenerUsuarioActual() {
        try {
            return SecurityContextHolder.getContext().getAuthentication().getName();
        } catch (Exception e) {
            return "SISTEMA";
        }
    }
}
