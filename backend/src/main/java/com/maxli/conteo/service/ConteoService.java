package com.maxli.conteo.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.service.AlmacenService;
import com.maxli.conteo.dto.ConteoCabeceraResponseDTO;
import com.maxli.conteo.dto.ConteoCreateRequestDTO;
import com.maxli.conteo.dto.ConteoDetalleRequestDTO;
import com.maxli.conteo.dto.ConteoDetallesBatchRequestDTO;
import com.maxli.conteo.dto.ConteoResumenResponseDTO;
import com.maxli.conteo.entity.ConteoCabecera;
import com.maxli.conteo.entity.ConteoDetalle;
import com.maxli.conteo.mapper.ConteoMapper;
import com.maxli.conteo.repository.ConteoCabeceraRepository;
import com.maxli.conteo.repository.ConteoDetalleRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.existencia.service.ExistenciaLockService.ClaveExistencia;
import com.maxli.inventario.entity.DetalleMovimiento;
import com.maxli.inventario.entity.Movimiento;
import com.maxli.inventario.repository.MovimientoRepository;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ConteoService {

    private final ConteoCabeceraRepository cabeceraRepository;
    private final ConteoDetalleRepository detalleRepository;
    private final ExistenciaRepository existenciaRepository;
    private final ExistenciaLockService existenciaLockService;
    private final ProductoRepository productoRepository;
    private final UsuarioRepository usuarioRepository;
    private final MovimientoRepository movimientoRepository;
    private final AlmacenService almacenService;
    private final ConteoMapper conteoMapper;

    // ── Consultas ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ConteoResumenResponseDTO> listar(Pageable pageable) {
        return cabeceraRepository.findAll(pageable).map(conteoMapper::toResumenDto);
    }

    @Transactional(readOnly = true)
    public Page<ConteoResumenResponseDTO> listarPorEstado(String estado, Pageable pageable) {
        return cabeceraRepository.findByEstado(estado, pageable).map(conteoMapper::toResumenDto);
    }

    @Transactional(readOnly = true)
    public Page<ConteoResumenResponseDTO> listarPorUsuario(Long idUsuario, Pageable pageable) {
        return cabeceraRepository.findByUsuarioAsignado_IdUsuario(idUsuario, pageable)
                .map(conteoMapper::toResumenDto);
    }

    @Transactional(readOnly = true)
    public ConteoCabeceraResponseDTO buscarPorId(Long id) {
        return conteoMapper.toDto(obtenerPorId(id));
    }

    // ── Crear documento de conteo ────────────────────────────

    @Transactional
    public ConteoCabeceraResponseDTO crear(ConteoCreateRequestDTO dto) {
        Almacen almacen = almacenService.obtenerEntidadPorId(dto.getIdAlmacen());
        if (!"ACTIVO".equals(almacen.getEstado())) {
            throw new BusinessException("El almacén '" + almacen.getNombre() + "' no está activo");
        }

        Usuario asignado = obtenerUsuarioActivo(dto.getIdUsuarioAsignado());

        ConteoCabecera cabecera = new ConteoCabecera();
        cabecera.setAlmacen(almacen);
        cabecera.setZona(dto.getZona());
        cabecera.setEstado("EN_PROCESO");
        cabecera.setUsuarioAsignado(asignado);
        cabecera.setObservacion(dto.getObservacion());

        ConteoCabecera guardada = cabeceraRepository.save(cabecera);
        return conteoMapper.toDto(guardada);
    }

    // ── Registrar líneas de conteo (Conteo Ciego) ────────────

    /**
     * Registra o actualiza líneas de conteo para un documento EN_PROCESO.
     * Implementa el "conteo ciego": no devuelve ni compara cantidades del sistema.
     * Si el producto ya fue contado en este documento, actualiza la cantidad.
     */
    @Transactional
    public ConteoCabeceraResponseDTO registrarLineas(Long idConteo, ConteoDetallesBatchRequestDTO dto) {
        ConteoCabecera cabecera = obtenerPorId(idConteo);

        if (!"EN_PROCESO".equals(cabecera.getEstado())) {
            throw new BusinessException(
                    "Solo se pueden registrar líneas en un conteo en estado EN_PROCESO. " +
                    "Estado actual: " + cabecera.getEstado());
        }

        for (ConteoDetalleRequestDTO lineaDto : dto.getLineas()) {
            Producto producto = productoRepository.findById(lineaDto.getIdProducto())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + lineaDto.getIdProducto()));

            // Buscar si ya existe una línea para este producto en este conteo
            Optional<ConteoDetalle> existente = detalleRepository
                    .findByConteo_IdConteoAndProducto_IdProducto(idConteo, lineaDto.getIdProducto());

            if (existente.isPresent()) {
                // Actualizar la cantidad física
                ConteoDetalle detalle = existente.get();
                detalle.setCantidadFisica(lineaDto.getCantidadFisica());
                detalle.setFechaRegistro(LocalDateTime.now());
                detalleRepository.save(detalle);
            } else {
                // Crear nueva línea
                ConteoDetalle detalle = new ConteoDetalle();
                detalle.setConteo(cabecera);
                detalle.setProducto(producto);
                detalle.setCantidadFisica(lineaDto.getCantidadFisica());
                detalle.setFechaRegistro(LocalDateTime.now());
                detalleRepository.save(detalle);
            }
        }

        // Refrescar cabecera para devolver los detalles actualizados
        return conteoMapper.toDto(obtenerPorId(idConteo));
    }

    // ── Enviar a revisión ────────────────────────────────────

    /**
     * Cambia el estado a REVISION y captura el snapshot del stock del sistema
     * para cada línea de conteo. Calcula la diferencia.
     */
    @Transactional
    public ConteoCabeceraResponseDTO enviarARevision(Long idConteo) {
        ConteoCabecera cabecera = obtenerPorId(idConteo);

        if (!"EN_PROCESO".equals(cabecera.getEstado())) {
            throw new BusinessException(
                    "Solo se puede enviar a revisión un conteo en estado EN_PROCESO. " +
                    "Estado actual: " + cabecera.getEstado());
        }

        if (cabecera.getDetalles() == null || cabecera.getDetalles().isEmpty()) {
            throw new BusinessException("No se puede enviar a revisión un conteo sin líneas registradas");
        }

        // Capturar snapshot del sistema y calcular diferencias
        for (ConteoDetalle detalle : cabecera.getDetalles()) {
            int cantidadSistema = existenciaRepository
                    .findByProducto_IdProductoAndAlmacen_IdAlmacen(
                            detalle.getProducto().getIdProducto(),
                            cabecera.getAlmacen().getIdAlmacen())
                    .map(Existencia::getCantidadActual)
                    .orElse(0);

            detalle.setCantidadSistema(cantidadSistema);
            detalle.setDiferencia(detalle.getCantidadFisica() - cantidadSistema);
        }

        cabecera.setEstado("REVISION");
        cabeceraRepository.save(cabecera);

        return conteoMapper.toDto(cabecera);
    }

    // ── Aplicar conteo (operación atómica) ───────────────────

    /**
     * Aplica el conteo físico: actualiza las existencias al valor contado
     * y genera un Movimiento de tipo AJUSTE como rastro de auditoría.
     * <p>
     * Operación atómica: si cualquier actualización falla, se revierte todo.
     * </p>
     */
    @Transactional
    public ConteoCabeceraResponseDTO aplicar(Long idConteo) {
        ConteoCabecera cabecera = obtenerPorId(idConteo);

        if (!"REVISION".equals(cabecera.getEstado())) {
            throw new BusinessException(
                    "Solo se puede aplicar un conteo en estado REVISION. " +
                    "Estado actual: " + cabecera.getEstado());
        }

        String usuarioActual = obtenerUsuarioActual();
        Usuario supervisor = usuarioRepository.findByUsername(usuarioActual)
                .orElse(null);

        // Crear movimiento de AJUSTE como rastro de auditoría
        Movimiento movimiento = new Movimiento();
        movimiento.setTipo("AJUSTE");
        movimiento.setAlmacenDestino(cabecera.getAlmacen());
        movimiento.setReferencia("CONTEO-" + idConteo);
        movimiento.setObservacion("Ajuste por conteo físico #" + idConteo +
                (cabecera.getZona() != null ? " — Zona: " + cabecera.getZona() : ""));
        movimiento.setEstado("COMPLETADO");
        movimiento.setUsuarioResponsable(usuarioActual);
        movimiento.setFechaMovimiento(LocalDateTime.now());

        boolean tieneAjustes = false;

        List<ClaveExistencia> clavesExistencia = cabecera.getDetalles().stream()
                .filter(detalle -> detalle.getDiferencia() != null && detalle.getDiferencia() != 0)
                .map(detalle -> new ClaveExistencia(detalle.getProducto().getIdProducto(),
                        cabecera.getAlmacen().getIdAlmacen()))
                .toList();
        Map<ClaveExistencia, Existencia> existenciasBloqueadas =
                existenciaLockService.bloquearOCrearEnOrden(clavesExistencia);

        for (ConteoDetalle detalle : cabecera.getDetalles()) {
            if (detalle.getDiferencia() == null || detalle.getDiferencia() == 0) {
                continue; // Sin diferencia, no hay ajuste necesario
            }

            tieneAjustes = true;

            // Aplicar la diferencia al saldo recién bloqueado evita que un
            // conteo con snapshot viejo sobrescriba una venta concurrente.
            Existencia existencia = existenciasBloqueadas.get(new ClaveExistencia(
                    detalle.getProducto().getIdProducto(), cabecera.getAlmacen().getIdAlmacen()));
            int nuevaCantidad = existencia.getCantidadActual() + detalle.getDiferencia();
            if (nuevaCantidad < 0) {
                throw new BusinessException("El ajuste del conteo dejaría stock negativo para el producto '" +
                        detalle.getProducto().getNombre() + "'");
            }
            existencia.setCantidadActual(nuevaCantidad);

            // Registrar detalle del movimiento de ajuste (la diferencia)
            DetalleMovimiento detalleMovimiento = new DetalleMovimiento();
            detalleMovimiento.setMovimiento(movimiento);
            detalleMovimiento.setProducto(detalle.getProducto());
            detalleMovimiento.setCantidad(Math.abs(detalle.getDiferencia()));
            movimiento.getDetalles().add(detalleMovimiento);
        }

        // Solo guardar el movimiento si hubo ajustes reales
        if (tieneAjustes) {
            movimientoRepository.save(movimiento);
        }

        // Actualizar cabecera
        cabecera.setEstado("APLICADO");
        cabecera.setFechaAplicacion(LocalDateTime.now());
        cabecera.setUsuarioSupervisor(supervisor);
        cabeceraRepository.save(cabecera);

        return conteoMapper.toDto(cabecera);
    }

    // ── Anular conteo ────────────────────────────────────────

    @Transactional
    public ConteoCabeceraResponseDTO anular(Long idConteo) {
        ConteoCabecera cabecera = obtenerPorId(idConteo);

        if ("APLICADO".equals(cabecera.getEstado())) {
            throw new BusinessException("No se puede anular un conteo ya aplicado");
        }

        if ("ANULADO".equals(cabecera.getEstado())) {
            throw new BusinessException("Este conteo ya está anulado");
        }

        cabecera.setEstado("ANULADO");
        cabeceraRepository.save(cabecera);

        return conteoMapper.toDto(cabecera);
    }

    // ── Métodos auxiliares ────────────────────────────────────

    private ConteoCabecera obtenerPorId(Long id) {
        return cabeceraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conteo no encontrado con id: " + id));
    }

    private Usuario obtenerUsuarioActivo(Long idUsuario) {
        return usuarioRepository.findById(idUsuario)
                .filter(u -> "ACTIVO".equals(u.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado o inactivo con id: " + idUsuario));
    }

    private String obtenerUsuarioActual() {
        try {
            return SecurityContextHolder.getContext().getAuthentication().getName();
        } catch (Exception e) {
            return "SISTEMA";
        }
    }
}
