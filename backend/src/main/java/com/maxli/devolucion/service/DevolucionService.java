package com.maxli.devolucion.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.devolucion.dto.CrearDevolucionRequestDTO;
import com.maxli.devolucion.dto.DetalleDevolucionRequestDTO;
import com.maxli.devolucion.dto.DevolucionResponseDTO;
import com.maxli.devolucion.dto.DevolucionResumenDTO;
import com.maxli.devolucion.dto.VentaDevolubleResponseDTO;
import com.maxli.devolucion.entity.DetalleDevolucion;
import com.maxli.devolucion.entity.Devolucion;
import com.maxli.devolucion.repository.DetalleDevolucionRepository;
import com.maxli.devolucion.repository.DevolucionRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.existencia.service.ExistenciaLockService.ClaveExistencia;
import com.maxli.inventario.service.TrazabilidadInventarioService;
import com.maxli.inventario.service.TrazabilidadInventarioService.CambioInventario;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.service.NcfService;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.venta.entity.DetalleVenta;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import com.maxli.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Devoluciones de venta con Nota de Crédito B04.
 * <p>
 * Una devolución confirmada es <b>una sola operación transaccional</b>: repone
 * inventario en el almacén de la venta original, emite exactamente un B04 que
 * referencia el NCF afectado, deja rastro en la bitácora de inventario, mueve
 * el estado de la venta y ajusta la caja del turno que entrega el reembolso. Si
 * cualquier paso falla —típicamente la resolución B04 ausente, vencida o
 * agotada— revierten todos, incluida la secuencia fiscal.
 * <p>
 * <b>Contrato de cálculo.</b> Nada se recalcula con precios, tasas ni
 * promociones actuales: el crédito sale de los snapshots que la venta persistió
 * en {@link DetalleVenta} (precio, importe, descuento prorrateado, base
 * imponible e ITBIS de línea). Una devolución parcial prorratea con
 * {@code BigDecimal} y {@code HALF_UP} a dos decimales; la que cierra la línea
 * acredita el remanente exacto, de modo que la suma de todas las devoluciones de
 * una línea reproduce al centavo los importes originales.
 * <p>
 * <b>Contrato de concurrencia.</b> La venta se bloquea con
 * {@code SELECT ... FOR UPDATE} antes de leer lo ya devuelto: sin ese bloqueo,
 * validar el acumulado y persistir es un check-then-act y dos solicitudes
 * simultáneas sobredevuelven. Las existencias se bloquean después, en orden
 * ascendente de producto, el mismo que usa el POS, para que no haya deadlocks
 * entre una venta y una devolución que tocan los mismos artículos.
 * <p>
 * Alcance fiscal: este servicio implementa la numeración B04, la referencia al
 * comprobante afectado y la trazabilidad interna. No cubre el envío electrónico
 * a la DGII ni el resto del cumplimiento.
 */
@Service
@RequiredArgsConstructor
public class DevolucionService {

    private static final String ACTIVO = "ACTIVO";
    private static final String ABIERTO = "ABIERTO";
    private static final String CONFIRMADA = "CONFIRMADA";
    private static final String COMPLETADA = "COMPLETADA";
    private static final String PARCIALMENTE_DEVUELTA = "PARCIALMENTE_DEVUELTA";
    private static final String DEVUELTA = "DEVUELTA";
    private static final String TIPO_NCF_NOTA_CREDITO = "B04";
    private static final String UK_REFERENCIA = "uk_devolucion_referencia";
    private static final Set<MetodoPago> REEMBOLSOS_PERMITIDOS = Set.of(
            MetodoPago.EFECTIVO, MetodoPago.TARJETA, MetodoPago.TRANSFERENCIA, MetodoPago.CHEQUE);

    private final DevolucionRepository devolucionRepository;
    private final DetalleDevolucionRepository detalleDevolucionRepository;
    private final VentaRepository ventaRepository;
    private final TurnoCajaRepository turnoCajaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ExistenciaLockService existenciaLockService;
    private final TrazabilidadInventarioService trazabilidadInventarioService;
    private final NcfService ncfService;

    // ═════════════════════════════════════════════════════════════════════
    //  1. Confirmar una devolución
    // ═════════════════════════════════════════════════════════════════════

    @Transactional
    public DevolucionResponseDTO crear(CrearDevolucionRequestDTO request, String username) {
        String referencia = request.getReferenciaOperacion().trim();

        // Idempotencia barata: un reintento se corta aquí, antes de bloquear
        // nada y sobre todo antes de consumir un comprobante fiscal. El índice
        // único cubre la carrera que este chequeo no puede ver.
        if (devolucionRepository.existsByReferenciaOperacion(referencia)) {
            throw new DuplicateResourceException(
                    "Ya existe una devolución con la referencia de operación: " + referencia);
        }

        MetodoPago metodoReembolso = parseMetodoReembolso(request.getMetodoReembolso());
        Usuario usuario = usuarioRepository.findByUsername(username)
                .filter(u -> ACTIVO.equals(u.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado o inactivo: " + username));
        TurnoCaja turno = obtenerTurnoAbiertoDelUsuario(request.getIdTurnoCaja(), usuario);

        // Bloqueo de la venta: serializa las devoluciones de esta venta entre sí.
        Venta venta = ventaRepository.bloquearPorId(request.getIdVenta())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada con id: " + request.getIdVenta()));
        validarVentaDevolvible(venta);

        List<DetalleDevolucionRequestDTO> lineasSolicitadas = validarLineas(venta, request.getDetalles());
        Map<Long, DetalleVenta> lineasVenta = indexarPorId(venta);
        Map<Long, Acreditado> acreditadoPrevio = acreditadoPrevio(lineasVenta.keySet());

        // ── Calcular el crédito de cada línea desde los snapshots de la venta ──
        Devolucion devolucion = new Devolucion();
        Map<Long, Integer> cantidadPorProducto = new TreeMap<>();
        Map<Long, Integer> devueltasTrasEsta = new HashMap<>();
        BigDecimal baseTotal = BigDecimal.ZERO;
        BigDecimal itbisTotal = BigDecimal.ZERO;

        for (DetalleDevolucionRequestDTO solicitud : lineasSolicitadas) {
            DetalleVenta lineaVenta = lineasVenta.get(solicitud.getIdDetalleVenta());
            Acreditado previo = acreditadoPrevio.getOrDefault(
                    lineaVenta.getIdDetalleVenta(), Acreditado.vacio());

            int vendida = lineaVenta.getCantidad();
            int disponible = vendida - previo.cantidad();
            if (solicitud.getCantidad() > disponible) {
                throw new BusinessException(String.format(
                        "No se puede devolver %d unidad(es) de '%s': se vendieron %d y ya se devolvieron %d.",
                        solicitud.getCantidad(), lineaVenta.getProducto().getNombre(), vendida, previo.cantidad()));
            }
            boolean cierraLaLinea = solicitud.getCantidad() == disponible;

            BigDecimal base = acreditar(lineaVenta.getBaseImponible(), previo.base(),
                    vendida, solicitud.getCantidad(), cierraLaLinea);
            BigDecimal itbis = acreditar(lineaVenta.getItbisLinea(), previo.itbis(),
                    vendida, solicitud.getCantidad(), cierraLaLinea);
            BigDecimal descuento = acreditar(lineaVenta.getDescuentoProrrateado(), previo.descuento(),
                    vendida, solicitud.getCantidad(), cierraLaLinea);

            DetalleDevolucion detalle = new DetalleDevolucion();
            detalle.setDetalleVenta(lineaVenta);
            detalle.setProducto(lineaVenta.getProducto());
            detalle.setCantidad(solicitud.getCantidad());
            detalle.setPrecioUnitario(lineaVenta.getPrecioUnitario());
            detalle.setTasaItbis(lineaVenta.getTasaItbis());
            detalle.setBaseImponibleAcreditada(base);
            detalle.setItbisAcreditado(itbis);
            detalle.setDescuentoAcreditado(descuento);
            detalle.setImporteAcreditado(base.add(itbis).add(descuento));
            devolucion.addDetalle(detalle);

            baseTotal = baseTotal.add(base);
            itbisTotal = itbisTotal.add(itbis);
            cantidadPorProducto.merge(
                    lineaVenta.getProducto().getIdProducto(), solicitud.getCantidad(), Integer::sum);
            devueltasTrasEsta.put(lineaVenta.getIdDetalleVenta(), previo.cantidad() + solicitud.getCantidad());
        }

        // ── Reponer inventario en el almacén de la venta original ─────────
        Almacen almacen = venta.getAlmacen();
        Map<Long, Existencia> existencias = bloquearExistenciasEnOrden(
                cantidadPorProducto.keySet(), almacen.getIdAlmacen());
        Map<Long, Integer> saldosAnteriores = new HashMap<>();
        for (Map.Entry<Long, Integer> entrada : cantidadPorProducto.entrySet()) {
            Existencia existencia = existencias.get(entrada.getKey());
            saldosAnteriores.put(entrada.getKey(), existencia.getCantidadActual());
            existencia.setCantidadActual(existencia.getCantidadActual() + entrada.getValue());
        }

        // ── Emitir la Nota de Crédito B04 ────────────────────────────────
        // Dentro de la misma transacción: si la resolución falta, está vencida
        // o agotada, revierten también el stock y el estado de la venta.
        NcfGeneradoDTO notaCredito = ncfService.generarSiguienteNcf(TIPO_NCF_NOTA_CREDITO);

        devolucion.setVenta(venta);
        devolucion.setTurnoCaja(turno);
        devolucion.setUsuario(usuario);
        devolucion.setAlmacen(almacen);
        devolucion.setNumeroControl(String.format("DV-%06d",
                devolucionRepository.obtenerSiguienteNumeroControl()));
        devolucion.setReferenciaOperacion(referencia);
        devolucion.setMotivo(request.getMotivo().trim());
        devolucion.setEstado(CONFIRMADA);
        devolucion.setMetodoReembolso(metodoReembolso);
        devolucion.setNcf(notaCredito.getNcfCompleto());
        devolucion.setTipoNcf(TIPO_NCF_NOTA_CREDITO);
        devolucion.setNcfAfectado(venta.getNcf());
        devolucion.setTipoNcfAfectado(venta.getTipoNcf());
        devolucion.setNumeroControlVenta(venta.getNumeroControl());
        devolucion.setNombreCliente(nombreCliente(venta));
        devolucion.setRncCliente(rncCliente(venta));
        devolucion.setBaseImponible(normalizar(baseTotal));
        devolucion.setItbis(normalizar(itbisTotal));
        devolucion.setTotal(normalizar(baseTotal.add(itbisTotal)));
        devolucion.setFechaDevolucion(LocalDateTime.now());

        Devolucion guardada = guardarTraduciendoIntegridad(devolucion);

        // ── Estado de la venta, trazabilidad y caja ──────────────────────
        venta.setEstado(nuevoEstadoVenta(venta, devueltasTrasEsta, acreditadoPrevio));
        ventaRepository.save(venta);

        List<CambioInventario> cambios = cantidadPorProducto.keySet().stream()
                .map(idProducto -> CambioInventario.entrada(
                        existencias.get(idProducto).getProducto(),
                        saldosAnteriores.get(idProducto),
                        existencias.get(idProducto).getCantidadActual()))
                .toList();
        trazabilidadInventarioService.registrar(
                "DEVOLUCION", null, almacen,
                guardada.getNumeroControl(),
                String.format("Entrada por devolución de la venta %s (NCF %s), nota de crédito %s",
                        venta.getNumeroControl(), venta.getNcf(), guardada.getNcf()),
                username,
                cambios);

        actualizarCuadreTurno(turno);

        return mapToResponseDTO(guardada, venta.getEstado());
    }

    // ═════════════════════════════════════════════════════════════════════
    //  2. Consultas
    // ═════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public DevolucionResponseDTO buscarPorId(Long id) {
        Devolucion devolucion = devolucionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Devolución no encontrada con id: " + id));
        return mapToResponseDTO(devolucion, devolucion.getVenta().getEstado());
    }

    /** Historial de devoluciones, opcionalmente acotado a una venta. */
    @Transactional(readOnly = true)
    public Page<DevolucionResumenDTO> listar(Long idVenta, Pageable pageable) {
        Pageable orden = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "idDevolucion"));
        return devolucionRepository.buscar(idVenta, orden).map(this::mapToResumenDTO);
    }

    /** Lo que todavía se puede devolver de una venta, línea por línea. */
    @Transactional(readOnly = true)
    public VentaDevolubleResponseDTO consultarDisponible(Long idVenta) {
        Venta venta = ventaRepository.findById(idVenta)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada con id: " + idVenta));

        Map<Long, DetalleVenta> lineasVenta = indexarPorId(venta);
        Map<Long, Acreditado> devuelto = acreditadoPrevio(lineasVenta.keySet());

        VentaDevolubleResponseDTO dto = new VentaDevolubleResponseDTO();
        dto.setIdVenta(venta.getIdVenta());
        dto.setNumeroControl(venta.getNumeroControl());
        dto.setNcf(venta.getNcf());
        dto.setTipoNcf(venta.getTipoNcf());
        dto.setEstado(venta.getEstado());
        dto.setFechaVenta(venta.getFechaVenta());
        dto.setClienteNombre(nombreCliente(venta));
        if (venta.getAlmacen() != null) {
            dto.setIdAlmacen(venta.getAlmacen().getIdAlmacen());
            dto.setAlmacenNombre(venta.getAlmacen().getNombre());
        }
        dto.setDevolvible(esDevolvible(venta));

        dto.setLineas(venta.getDetalles().stream().map(linea -> {
            int yaDevuelta = devuelto.getOrDefault(linea.getIdDetalleVenta(), Acreditado.vacio()).cantidad();
            VentaDevolubleResponseDTO.LineaDevolubleDTO fila = new VentaDevolubleResponseDTO.LineaDevolubleDTO();
            fila.setIdDetalleVenta(linea.getIdDetalleVenta());
            fila.setIdProducto(linea.getProducto().getIdProducto());
            fila.setSkuProducto(linea.getProducto().getSku());
            fila.setNombreProducto(linea.getProducto().getNombre());
            fila.setCantidadVendida(linea.getCantidad());
            fila.setCantidadDevuelta(yaDevuelta);
            fila.setCantidadDisponible(linea.getCantidad() - yaDevuelta);
            fila.setPrecioUnitario(linea.getPrecioUnitario());
            fila.setTasaItbis(linea.getTasaItbis());
            fila.setImporte(linea.getImporte());
            return fila;
        }).toList());

        return dto;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: validación
    // ═════════════════════════════════════════════════════════════════════

    private TurnoCaja obtenerTurnoAbiertoDelUsuario(Long idTurnoCaja, Usuario usuario) {
        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Turno de caja no encontrado con id: " + idTurnoCaja));
        if (!ABIERTO.equals(turno.getEstado())) {
            throw new BusinessException(
                    "No se puede devolver: el turno de caja no está abierto. El reembolso necesita una caja operando.");
        }
        if (!turno.getUsuarioApertura().getIdUsuario().equals(usuario.getIdUsuario())) {
            throw new BusinessException("El turno de caja no pertenece al usuario actual.");
        }
        return turno;
    }

    private void validarVentaDevolvible(Venta venta) {
        if (!COMPLETADA.equals(venta.getEstado()) && !PARCIALMENTE_DEVUELTA.equals(venta.getEstado())) {
            throw new BusinessException(String.format(
                    "La venta %s está en estado '%s' y no admite devoluciones.",
                    venta.getNumeroControl(), venta.getEstado()));
        }
        if (venta.getNcf() == null || venta.getNcf().isBlank()) {
            throw new BusinessException(String.format(
                    "La venta %s no tiene NCF: una nota de crédito debe referenciar el comprobante afectado.",
                    venta.getNumeroControl()));
        }
        if (venta.getAlmacen() == null) {
            throw new BusinessException(String.format(
                    "La venta %s no registra el almacén del que salió la mercancía, así que no se sabe dónde reponerla.",
                    venta.getNumeroControl()));
        }
    }

    private boolean esDevolvible(Venta venta) {
        return (COMPLETADA.equals(venta.getEstado()) || PARCIALMENTE_DEVUELTA.equals(venta.getEstado()))
                && venta.getNcf() != null && !venta.getNcf().isBlank()
                && venta.getAlmacen() != null;
    }

    /** Rechaza líneas ajenas y repetidas antes de tocar stock, NCF o caja. */
    private List<DetalleDevolucionRequestDTO> validarLineas(
            Venta venta, List<DetalleDevolucionRequestDTO> solicitadas) {

        Map<Long, DetalleVenta> lineasVenta = indexarPorId(venta);
        Set<Long> vistas = new LinkedHashSet<>();
        for (DetalleDevolucionRequestDTO solicitud : solicitadas) {
            if (!lineasVenta.containsKey(solicitud.getIdDetalleVenta())) {
                throw new BusinessException(String.format(
                        "La línea %d no pertenece a la venta %s.",
                        solicitud.getIdDetalleVenta(), venta.getNumeroControl()));
            }
            if (!vistas.add(solicitud.getIdDetalleVenta())) {
                throw new BusinessException(String.format(
                        "La línea %d aparece más de una vez en la solicitud. "
                                + "Agrupe la cantidad total en una sola línea.",
                        solicitud.getIdDetalleVenta()));
            }
        }
        return solicitadas;
    }

    private MetodoPago parseMetodoReembolso(String metodo) {
        MetodoPago metodoReembolso;
        try {
            metodoReembolso = MetodoPago.valueOf(metodo.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            metodoReembolso = null;
        }
        if (metodoReembolso == null || !REEMBOLSOS_PERMITIDOS.contains(metodoReembolso)) {
            throw new BusinessException("Método de reembolso inválido: " + metodo
                    + ". Valores permitidos: EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE");
        }
        return metodoReembolso;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: prorrateo desde los snapshots de la venta
    // ═════════════════════════════════════════════════════════════════════

    /** Lo ya acreditado sobre una línea de venta por devoluciones anteriores. */
    private record Acreditado(int cantidad, BigDecimal base, BigDecimal itbis, BigDecimal descuento) {

        static Acreditado vacio() {
            return new Acreditado(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        Acreditado mas(DetalleDevolucion detalle) {
            return new Acreditado(
                    cantidad + detalle.getCantidad(),
                    base.add(detalle.getBaseImponibleAcreditada()),
                    itbis.add(detalle.getItbisAcreditado()),
                    descuento.add(detalle.getDescuentoAcreditado()));
        }
    }

    private Map<Long, Acreditado> acreditadoPrevio(Set<Long> idsDetalleVenta) {
        Map<Long, Acreditado> acumulado = new HashMap<>();
        if (idsDetalleVenta.isEmpty()) {
            return acumulado;
        }
        for (DetalleDevolucion detalle
                : detalleDevolucionRepository.findByDetalleVenta_IdDetalleVentaIn(idsDetalleVenta)) {
            Long idLinea = detalle.getDetalleVenta().getIdDetalleVenta();
            acumulado.merge(idLinea, Acreditado.vacio().mas(detalle),
                    (previo, nuevo) -> new Acreditado(
                            previo.cantidad() + nuevo.cantidad(),
                            previo.base().add(nuevo.base()),
                            previo.itbis().add(nuevo.itbis()),
                            previo.descuento().add(nuevo.descuento())));
        }
        return acumulado;
    }

    /**
     * Parte de {@code original} que corresponde a {@code cantidad} unidades.
     * <p>
     * Mientras queden unidades por devolver se prorratea con HALF_UP a dos
     * decimales. La devolución que cierra la línea recibe el remanente exacto
     * —lo original menos lo ya acreditado— y no un prorrateo: así la suma de
     * todas las devoluciones de esa línea reproduce el importe original al
     * centavo, sin arrastrar el error de redondeo.
     */
    private BigDecimal acreditar(BigDecimal original, BigDecimal yaAcreditado,
                                 int cantidadVendida, int cantidad, boolean cierraLaLinea) {
        BigDecimal valor = original == null ? BigDecimal.ZERO : original;
        if (cierraLaLinea) {
            return normalizar(valor.subtract(yaAcreditado).max(BigDecimal.ZERO));
        }
        return valor.multiply(BigDecimal.valueOf(cantidad))
                .divide(BigDecimal.valueOf(cantidadVendida), 2, RoundingMode.HALF_UP);
    }

    /**
     * DEVUELTA solo cuando ninguna línea conserva unidades pendientes; mientras
     * quede algo por devolver, PARCIALMENTE_DEVUELTA. Los importes históricos de
     * la venta no se tocan nunca: la nota de crédito es el documento que
     * registra la reversión.
     */
    private String nuevoEstadoVenta(Venta venta, Map<Long, Integer> devueltasTrasEsta,
                                    Map<Long, Acreditado> acreditadoPrevio) {
        for (DetalleVenta linea : venta.getDetalles()) {
            int devuelta = devueltasTrasEsta.containsKey(linea.getIdDetalleVenta())
                    ? devueltasTrasEsta.get(linea.getIdDetalleVenta())
                    : acreditadoPrevio.getOrDefault(linea.getIdDetalleVenta(), Acreditado.vacio()).cantidad();
            if (devuelta < linea.getCantidad()) {
                return PARCIALMENTE_DEVUELTA;
            }
        }
        return DEVUELTA;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: inventario y caja
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Bloquea las existencias a reponer en orden ascendente de producto —el
     * mismo criterio que usa el POS al vender— para que una venta y una
     * devolución concurrentes sobre los mismos artículos no se bloqueen en
     * cruz. Si el producto ya no tiene fila en ese almacén se crea en cero:
     * la mercancía vuelve igual, aunque el maestro haya cambiado.
     */
    private Map<Long, Existencia> bloquearExistenciasEnOrden(Set<Long> idsProducto, Long idAlmacen) {
        List<ClaveExistencia> claves = idsProducto.stream().sorted()
                .map(idProducto -> new ClaveExistencia(idProducto, idAlmacen))
                .toList();
        Map<Long, Existencia> porProducto = new HashMap<>();
        existenciaLockService.bloquearOCrearEnOrden(claves)
                .forEach((clave, existencia) -> porProducto.put(clave.idProducto(), existencia));
        return porProducto;
    }

    /**
     * Recalcula el efectivo esperado del turno que entregó el reembolso.
     * <p>
     * Solo el efectivo sale del cajón; tarjeta, transferencia y cheque quedan
     * registrados pero no cambian lo que el cajero debe tener en mano. El total
     * devuelto se guarda en el turno —y no solo se resta al vuelo— para que
     * recalcular el cuadre tras una venta posterior no borre el ajuste.
     */
    private void actualizarCuadreTurno(TurnoCaja turno) {
        BigDecimal devolucionesEfectivo = normalizar(
                devolucionRepository.sumarReembolsosEfectivoPorTurno(turno.getIdTurnoCaja()));
        turno.setTotalDevolucionesEfectivo(devolucionesEfectivo);
        turno.setMontoEsperado(normalizar(turno.getMontoInicial()
                .add(valor(turno.getTotalVentasEfectivo()))
                .add(valor(turno.getTotalOtrosIngresos()))
                .subtract(valor(turno.getTotalEgresos()))
                .subtract(devolucionesEfectivo)));
        turnoCajaRepository.save(turno);
    }

    private Devolucion guardarTraduciendoIntegridad(Devolucion devolucion) {
        try {
            return devolucionRepository.saveAndFlush(devolucion);
        } catch (DataIntegrityViolationException e) {
            Throwable causa = e.getMostSpecificCause();
            String detalle = causa == null || causa.getMessage() == null ? "" : causa.getMessage();
            if (detalle.contains(UK_REFERENCIA)) {
                throw new DuplicateResourceException(
                        "Ya existe una devolución con la referencia de operación: "
                                + devolucion.getReferenciaOperacion());
            }
            throw e;
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═════════════════════════════════════════════════════════════════════

    private Map<Long, DetalleVenta> indexarPorId(Venta venta) {
        Map<Long, DetalleVenta> lineas = new HashMap<>();
        for (DetalleVenta linea : venta.getDetalles()) {
            lineas.put(linea.getIdDetalleVenta(), linea);
        }
        return lineas;
    }

    private String nombreCliente(Venta venta) {
        return venta.getCliente() != null
                ? venta.getCliente().getNombreCompleto()
                : venta.getNombreClienteTemporal();
    }

    private String rncCliente(Venta venta) {
        return venta.getCliente() != null ? venta.getCliente().getRncCedula() : venta.getRncTemporal();
    }

    private BigDecimal normalizar(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal valor(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  MAPPERS
    // ═════════════════════════════════════════════════════════════════════

    private DevolucionResponseDTO mapToResponseDTO(Devolucion devolucion, String estadoVenta) {
        DevolucionResponseDTO dto = new DevolucionResponseDTO();
        dto.setIdDevolucion(devolucion.getIdDevolucion());
        dto.setNumeroControl(devolucion.getNumeroControl());
        dto.setReferenciaOperacion(devolucion.getReferenciaOperacion());
        dto.setMotivo(devolucion.getMotivo());
        dto.setEstado(devolucion.getEstado());
        dto.setMetodoReembolso(devolucion.getMetodoReembolso().name());
        dto.setFechaDevolucion(devolucion.getFechaDevolucion());
        dto.setNcf(devolucion.getNcf());
        dto.setTipoNcf(devolucion.getTipoNcf());
        dto.setNcfAfectado(devolucion.getNcfAfectado());
        dto.setTipoNcfAfectado(devolucion.getTipoNcfAfectado());
        dto.setIdVenta(devolucion.getVenta().getIdVenta());
        dto.setNumeroControlVenta(devolucion.getNumeroControlVenta());
        dto.setEstadoVenta(estadoVenta);
        dto.setClienteNombre(devolucion.getNombreCliente());
        dto.setClienteRncCedula(devolucion.getRncCliente());
        dto.setIdTurnoCaja(devolucion.getTurnoCaja().getIdTurnoCaja());
        dto.setCajeroNombre(devolucion.getUsuario().getUsername());
        dto.setIdAlmacen(devolucion.getAlmacen().getIdAlmacen());
        dto.setAlmacenNombre(devolucion.getAlmacen().getNombre());
        dto.setBaseImponible(devolucion.getBaseImponible());
        dto.setItbis(devolucion.getItbis());
        dto.setTotal(devolucion.getTotal());

        dto.setDetalles(devolucion.getDetalles().stream().map(detalle -> {
            DevolucionResponseDTO.DetalleDevolucionResponseDTO fila =
                    new DevolucionResponseDTO.DetalleDevolucionResponseDTO();
            fila.setIdDetalleDevolucion(detalle.getIdDetalleDevolucion());
            fila.setIdDetalleVenta(detalle.getDetalleVenta().getIdDetalleVenta());
            fila.setIdProducto(detalle.getProducto().getIdProducto());
            fila.setSkuProducto(detalle.getProducto().getSku());
            fila.setNombreProducto(detalle.getProducto().getNombre());
            fila.setCantidad(detalle.getCantidad());
            fila.setPrecioUnitario(detalle.getPrecioUnitario());
            fila.setTasaItbis(detalle.getTasaItbis());
            fila.setDescuentoAcreditado(detalle.getDescuentoAcreditado());
            fila.setImporteAcreditado(detalle.getImporteAcreditado());
            fila.setBaseImponibleAcreditada(detalle.getBaseImponibleAcreditada());
            fila.setItbisAcreditado(detalle.getItbisAcreditado());
            return fila;
        }).toList());

        return dto;
    }

    private DevolucionResumenDTO mapToResumenDTO(Devolucion devolucion) {
        DevolucionResumenDTO dto = new DevolucionResumenDTO();
        dto.setIdDevolucion(devolucion.getIdDevolucion());
        dto.setNumeroControl(devolucion.getNumeroControl());
        dto.setReferenciaOperacion(devolucion.getReferenciaOperacion());
        dto.setFechaDevolucion(devolucion.getFechaDevolucion());
        dto.setNcf(devolucion.getNcf());
        dto.setNcfAfectado(devolucion.getNcfAfectado());
        dto.setIdVenta(devolucion.getVenta().getIdVenta());
        dto.setNumeroControlVenta(devolucion.getNumeroControlVenta());
        dto.setCajeroNombre(devolucion.getUsuario().getUsername());
        dto.setMetodoReembolso(devolucion.getMetodoReembolso().name());
        dto.setTotal(devolucion.getTotal());
        dto.setEstado(devolucion.getEstado());
        return dto;
    }
}
