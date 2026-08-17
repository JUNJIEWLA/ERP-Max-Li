package com.maxli.venta.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.cliente.entity.Cliente;
import com.maxli.cliente.repository.ClienteRepository;
import com.maxli.cupon.service.CuponService;
import com.maxli.cupon.dto.CuponAplicadoDTO;
import com.maxli.cupon.dto.LineaParaCuponDTO;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ParametroInvalidoException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.inventario.service.TrazabilidadInventarioService;
import com.maxli.inventario.service.TrazabilidadInventarioService.CambioInventario;
import com.maxli.ncf.service.NcfService;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.oferta.entity.Oferta;
import com.maxli.oferta.entity.OfertaCantidad;
import com.maxli.oferta.entity.OfertaDescuento;
import com.maxli.oferta.repository.OfertaRepository;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.venta.dto.CrearVentaRequestDTO;
import com.maxli.venta.dto.DetalleVentaRequestDTO;
import com.maxli.venta.dto.IngresoVentaRequestDTO;
import com.maxli.venta.dto.RecalcularFacturaRequestDTO;
import com.maxli.venta.dto.RecalcularFacturaResponseDTO;
import com.maxli.venta.dto.RecalcularFacturaResponseDTO.DetalleRecalculadoDTO;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.dto.VentaResponseDTO;
import com.maxli.venta.dto.VentaResumenDTO;
import com.maxli.venta.entity.DetalleVenta;
import com.maxli.venta.entity.IngresoVenta;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import com.maxli.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class VentaService {

    private static final BigDecimal CIEN = new BigDecimal("100");
    private static final String ABIERTO = "ABIERTO";
    private static final String ACTIVO = "ACTIVO";
    private static final String COMPLETADA = "COMPLETADA";
    private static final String DETALLE = "DETALLE";
    private static final String MAYOR = "MAYOR";
    private static final String B01 = "B01";
    /**
     * Tipos que puede emitir una venta. B04 queda fuera a propósito: es la Nota
     * de Crédito y solo la emite DevolucionService. NcfService lo acepta —la
     * administración de resoluciones y las devoluciones lo necesitan—, así que
     * el POS tiene que cerrar la puerta por su cuenta o una venta común
     * consumiría la secuencia de notas de crédito.
     */
    private static final Set<String> TIPOS_NCF_VENTA = Set.of("B01", "B02", "B14", "B15");

    private final VentaRepository ventaRepository;
    private final TurnoCajaRepository turnoCajaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProductoRepository productoRepository;
    private final ExistenciaRepository existenciaRepository;
    private final ExistenciaLockService existenciaLockService;
    private final OfertaRepository ofertaRepository;
    private final NcfService ncfService;
    private final CuponService cuponService;
    private final ClienteRepository clienteRepository;
    private final TrazabilidadInventarioService trazabilidadInventarioService;
    private final com.maxli.devolucion.repository.DevolucionRepository devolucionRepository;

    // ═════════════════════════════════════════════════════════════════════
    //  1. RECÁLCULO DINÁMICO (preview — no persiste nada)
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Motor de recálculo dinámico.
     * <p>
     * Reglas:
     * <ol>
     *   <li>Si el método de pago NO {@code aplicaParaMayorista} → forzar precio detalle</li>
     *   <li>Si el tipo NCF es B01 (Crédito Fiscal) → forzar precio detalle</li>
     *   <li>Si el producto tiene oferta activa → forzar precio detalle para ESE item</li>
     *   <li>Si la cantidad es menor al mínimo mayorista → forzar precio detalle</li>
     * </ol>
     */
    @Transactional(readOnly = true)
    public RecalcularFacturaResponseDTO recalcularFactura(RecalcularFacturaRequestDTO request) {
        validarTipoNcfDeVenta(request.getTipoNcf());
        validarDescuentos(request.getDescuentoGlobal(), request.getDetalles());

        MetodoPago metodo = parseMetodoPago(request.getMetodoPago());
        boolean solicitaMayor = request.isUsaPrecioMayor();
        boolean esB01 = B01.equalsIgnoreCase(request.getTipoNcf());

        // ¿El método de pago y NCF permiten mayorista?
        boolean mayorPermitidoGlobal = metodo.isAplicaParaMayorista() && !esB01;
        // Si el método es MIXTO, evaluamos los componentes no-mayoristas por seguridad → no mayorista
        if (metodo == MetodoPago.MIXTO) {
            mayorPermitidoGlobal = false;
        }

        RecalcularFacturaResponseDTO response = new RecalcularFacturaResponseDTO();
        List<DetalleRecalculadoDTO> detallesRecalculados = new ArrayList<>();

        BigDecimal descuentoTotal = BigDecimal.ZERO;
        boolean huboRecalculo = false;

        for (DetalleVentaRequestDTO item : request.getDetalles()) {
            Producto producto = productoRepository.findById(item.getIdProducto())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + item.getIdProducto()));

            DetalleRecalculadoDTO detalle = calcularLineaDetalle(
                    producto, item.getCantidad(), item.getDescuentoLinea(),
                    solicitaMayor, mayorPermitidoGlobal);

            if (detalle.isRecalculado()) {
                huboRecalculo = true;
            }

            descuentoTotal = descuentoTotal.add(
                    detalle.getDescuentoOferta() != null ? detalle.getDescuentoOferta() : BigDecimal.ZERO);

            detallesRecalculados.add(detalle);
        }

        BigDecimal descuentoGlobal = valor(request.getDescuentoGlobal());
        TotalesVenta totales = calcularTotalesConItbisPorLinea(
                detallesRecalculados, descuentoGlobal, request.getCodigoCupon(), cuponService::previsualizarCupon);

        if (request.getCodigoCupon() != null && !request.getCodigoCupon().isBlank()) {
            response.setCodigoCupon(request.getCodigoCupon());
            response.setDescuentoCupon(totales.descuentoCuponAplicado());
        }

        response.setDetalles(detallesRecalculados);
        response.setSubtotal(totales.subtotal());
        response.setDescuentoTotal(normalizar(
                descuentoTotal.add(totales.descuentoGlobalAplicado()).add(totales.descuentoCuponAplicado())));
        response.setItbis(totales.itbis());
        response.setTotal(totales.total());
        response.setHuboRecalculo(huboRecalculo);

        return response;
    }


    // ═════════════════════════════════════════════════════════════════════
    //  2. PROCESAMIENTO ATÓMICO DE VENTA
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Procesa la venta completa en una sola transacción:
     * <ol>
     *   <li>Validar turno abierto</li>
     *   <li>Bloquear existencias y validar stock de todos los items</li>
     *   <li>Generar NCF</li>
     *   <li>Recalcular precios según reglas</li>
     *   <li>Aplicar ofertas vigentes</li>
     *   <li>Validar y aplicar cupón</li>
     *   <li>Decrementar existencias</li>
     *   <li>Registrar ingresos por método de pago</li>
     *   <li>Actualizar cuadre del turno de caja</li>
     * </ol>
     */
    @Transactional
    public VentaResponseDTO procesarVenta(CrearVentaRequestDTO request, String username) {
        // ── 0. Validar descuentos ─────────────────────────────────────────
        // Antes de cualquier efecto secundario: una solicitud con descuento
        // inválido no debe consumir NCF ni tocar stock o caja (ISSUE-008).
        validarTipoNcfDeVenta(request.getTipoNcf());
        validarDescuentos(request.getDescuentoGlobal(), request.getDetalles());

        // ── 1. Validar turno abierto ─────────────────────────────────────
        if (request.getIdTurnoCaja() == null) {
            throw new BusinessException("No se puede procesar la venta: se requiere un turno de caja abierto.");
        }

        // El turno se bloquea antes de leerlo: el cuadre se recalcula al final
        // de la venta, y sin bloqueo un cierre concurrente podría confirmarse
        // entre medias y quedar pisado por el guardado de esta transacción.
        TurnoCaja turno = turnoCajaRepository.bloquearPorId(request.getIdTurnoCaja())
                .filter(t -> ABIERTO.equals(t.getEstado()))
                .orElseThrow(() -> new BusinessException(
                        "No se puede procesar la venta: turno de caja no encontrado o no está abierto."));

        // Verificar que el turno pertenece al usuario
        Usuario usuario = usuarioRepository.findByUsername(username)
                .filter(u -> ACTIVO.equals(u.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado o inactivo: " + username));

        if (!turno.getUsuarioApertura().getIdUsuario().equals(usuario.getIdUsuario())) {
            throw new BusinessException("El turno de caja no pertenece al usuario actual.");
        }

        // El almacén de la venta se deriva de la caja del turno, nunca se
        // adivina: sin este vínculo no hay forma confiable de saber de qué
        // ubicación descontar existencia cuando el producto está en varios
        // almacenes (ISSUE-007).
        Almacen almacen = turno.getCaja().getAlmacen();
        if (almacen == null) {
            throw new BusinessException(
                    "La caja del turno no tiene un almacén asignado. Asígnelo desde Administración > Cajas antes de vender.");
        }
        if (!ACTIVO.equals(almacen.getEstado())) {
            throw new BusinessException(String.format(
                    "El almacén '%s' asignado a esta caja está inactivo. No se puede vender hasta reasignarlo.",
                    almacen.getNombre()));
        }

        // ── 2. Parsear método de pago ────────────────────────────────────
        MetodoPago metodo = parseMetodoPago(request.getMetodoPago());
        boolean esB01 = B01.equalsIgnoreCase(request.getTipoNcf());
        boolean mayorPermitido = metodo.isAplicaParaMayorista() && !esB01;
        if (metodo == MetodoPago.MIXTO) {
            mayorPermitido = false;
        }

        // Se valida antes de bloquear stock y de generar NCF: un cobro mal
        // compuesto no debe consumir secuencia fiscal.
        validarComposicionPagos(metodo, request.getIngresos());

        // ── 3. Crear la venta ────────────────────────────────────────────
        Venta venta = new Venta();
        venta.setTurnoCaja(turno);
        venta.setUsuario(usuario);
        venta.setAlmacen(almacen);
        venta.setMetodoPagoPrincipal(metodo);
        venta.setUsaPrecioMayor(request.isUsaPrecioMayor() && mayorPermitido);
        venta.setTipoNcf(request.getTipoNcf());
        venta.setEstado(COMPLETADA);
        venta.setFechaVenta(LocalDateTime.now());

        // Cliente registrado o temporal
        if (request.getIdCliente() != null) {
            Cliente cliente = clienteRepository.findById(request.getIdCliente())
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado con id: " + request.getIdCliente()));
            venta.setCliente(cliente);
        }
        venta.setNombreClienteTemporal(request.getNombreClienteTemporal());
        venta.setRncTemporal(request.getRncTemporal());

        // Número de control interno
        Long seq = ventaRepository.obtenerSiguienteNumeroControl();
        venta.setNumeroControl(String.format("VT-%06d", seq));

        // ── 4. Bloquear existencias y validar stock ──────────────────────
        // Antes de consumir el NCF: si el stock no alcanza, la venta se rechaza
        // sin haber tocado la secuencia fiscal.
        Map<Long, Existencia> existenciasBloqueadas =
                bloquearYValidarStock(request.getDetalles(), almacen.getIdAlmacen());
        Map<Long, Integer> saldosAnteriores = existenciasBloqueadas.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, entry -> entry.getValue().getCantidadActual()));

        // ── 5. Generar NCF ───────────────────────────────────────────────
        if (request.getTipoNcf() != null && !request.getTipoNcf().isBlank()) {
            NcfGeneradoDTO ncfGenerado = ncfService.generarSiguienteNcf(request.getTipoNcf());
            venta.setNcf(ncfGenerado.getNcfCompleto());
        }

        // ── 6. Procesar líneas de detalle ────────────────────────────────
        BigDecimal descuentoTotal = BigDecimal.ZERO;
        List<DetalleVenta> detallesEntidades = new ArrayList<>();
        List<DetalleRecalculadoDTO> detallesCalculados = new ArrayList<>();

        for (DetalleVentaRequestDTO item : request.getDetalles()) {
            Producto producto = productoRepository.findById(item.getIdProducto())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + item.getIdProducto()));

            // Existencia ya bloqueada y validada en el paso 4
            Existencia existencia = existenciasBloqueadas.get(producto.getIdProducto());

            // Calcular línea con reglas de precio
            DetalleRecalculadoDTO calc = calcularLineaDetalle(
                    producto, item.getCantidad(), item.getDescuentoLinea(),
                    request.isUsaPrecioMayor(), mayorPermitido);

            // Crear entidad detalle (base imponible/ITBIS de línea se
            // completan más abajo, tras prorratear descuento global/cupón)
            DetalleVenta detalle = new DetalleVenta();
            detalle.setProducto(producto);
            detalle.setCantidad(item.getCantidad());
            detalle.setPrecioUnitario(calc.getPrecioUnitario());
            detalle.setPrecioUnitarioOriginal(calc.getPrecioUnitarioOriginal());
            detalle.setTipoPrecio(calc.getTipoPrecio());
            detalle.setTasaItbis(calc.getTasaItbis());
            detalle.setDescuentoLinea(calc.getDescuentoLinea());
            detalle.setDescuentoOferta(calc.getDescuentoOferta());
            detalle.setOfertaAplicada(calc.getOfertaAplicada());
            detalle.setImporte(calc.getImporte());
            venta.addDetalle(detalle);
            detallesEntidades.add(detalle);
            detallesCalculados.add(calc);

            descuentoTotal = descuentoTotal.add(
                    calc.getDescuentoOferta() != null ? calc.getDescuentoOferta() : BigDecimal.ZERO);

            // Decrementar stock
            existencia.setCantidadActual(existencia.getCantidadActual() - item.getCantidad());
            existenciaRepository.save(existencia);
        }

        // ── 7-8. Descuento global + cupón, prorrateados, e ITBIS por línea ──
        // Orden: línea/oferta (ya en `importe`) → global entre todas las
        // líneas → cupón solo entre sus líneas elegibles (ISSUE-008).
        BigDecimal descuentoGlobal = valor(request.getDescuentoGlobal());
        TotalesVenta totales = calcularTotalesConItbisPorLinea(
                detallesCalculados, descuentoGlobal, request.getCodigoCupon(), cuponService::validarYAplicarCupon);

        for (int i = 0; i < detallesEntidades.size(); i++) {
            detallesEntidades.get(i).setDescuentoProrrateado(detallesCalculados.get(i).getDescuentoProrrateado());
            detallesEntidades.get(i).setBaseImponible(detallesCalculados.get(i).getBaseImponible());
            detallesEntidades.get(i).setItbisLinea(detallesCalculados.get(i).getItbisLinea());
        }

        if (request.getCodigoCupon() != null && !request.getCodigoCupon().isBlank()) {
            venta.setCodigoCupon(request.getCodigoCupon());
            venta.setDescuentoCupon(totales.descuentoCuponAplicado());
        }
        descuentoTotal = descuentoTotal.add(totales.descuentoGlobalAplicado()).add(totales.descuentoCuponAplicado());

        venta.setSubtotal(totales.subtotal());
        venta.setDescuentoTotal(normalizar(descuentoTotal));
        venta.setItbis(totales.itbis());
        venta.setTotal(totales.total());
        BigDecimal totalVenta = totales.total();

        // ── 9. Registrar ingresos (pagos) ────────────────────────────────
        BigDecimal totalPagado = BigDecimal.ZERO;
        BigDecimal efectivoRecibido = BigDecimal.ZERO;
        for (IngresoVentaRequestDTO ingresoDto : request.getIngresos()) {
            MetodoPago metodoPagoIngreso = parseMetodoPago(ingresoDto.getMetodoPago());
            IngresoVenta ingreso = new IngresoVenta();
            ingreso.setMetodoPago(metodoPagoIngreso);
            ingreso.setMonto(ingresoDto.getMonto());
            ingreso.setReferencia(ingresoDto.getReferencia());
            ingreso.setFechaRegistro(LocalDateTime.now());
            venta.addIngreso(ingreso);
            totalPagado = totalPagado.add(ingresoDto.getMonto());
            if (metodoPagoIngreso == MetodoPago.EFECTIVO) {
                efectivoRecibido = efectivoRecibido.add(ingresoDto.getMonto());
            } else if (metodoPagoIngreso == MetodoPago.NOTA_CREDITO) {
                if (ingresoDto.getReferencia() == null || ingresoDto.getReferencia().isBlank()) {
                    throw new BusinessException("Debe indicar el número de comprobante/factura de la Nota de Crédito.");
                }
                List<com.maxli.devolucion.entity.Devolucion> ncs = devolucionRepository.buscarPorNumero(ingresoDto.getReferencia().trim());
                if (ncs.isEmpty()) {
                    throw new BusinessException("No existe una Nota de Crédito válida para el número: " + ingresoDto.getReferencia());
                }
                BigDecimal pendienteCobrarNC = ingresoDto.getMonto();
                for (com.maxli.devolucion.entity.Devolucion nc : ncs) {
                    BigDecimal dispon = nc.getMontoDisponible() != null ? nc.getMontoDisponible() : BigDecimal.ZERO;
                    if (dispon.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal aplicar = dispon.min(pendienteCobrarNC);
                        nc.setMontoDisponible(dispon.subtract(aplicar));
                        nc.setMontoUsado((nc.getMontoUsado() != null ? nc.getMontoUsado() : BigDecimal.ZERO).add(aplicar));
                        devolucionRepository.save(nc);
                        pendienteCobrarNC = pendienteCobrarNC.subtract(aplicar);
                        if (pendienteCobrarNC.compareTo(BigDecimal.ZERO) <= 0) break;
                    }
                }
                if (pendienteCobrarNC.compareTo(BigDecimal.ZERO) > 0) {
                    throw new BusinessException("El saldo disponible en la Nota de Crédito es insuficiente para cubrir los RD$ " + ingresoDto.getMonto());
                }
                turno.setTotalVentasNotaCredito(
                        (turno.getTotalVentasNotaCredito() != null ? turno.getTotalVentasNotaCredito() : BigDecimal.ZERO)
                                .add(ingresoDto.getMonto())
                );
            }
        }

        if (totalPagado.compareTo(totalVenta) < 0) {
            throw new BusinessException(String.format(
                    "El monto pagado (RD$ %.2f) es menor al total de la venta (RD$ %.2f).",
                    totalPagado, totalVenta));
        }

        // El cambio sale del cajón, así que solo puede devolverse contra el
        // efectivo que entregó el cliente. Un sobrepago con tarjeta,
        // transferencia o cheque es un error de digitación, no un vuelto
        // (ISSUE-006).
        BigDecimal cambio = normalizar(totalPagado.subtract(totalVenta));
        if (cambio.compareTo(efectivoRecibido) > 0) {
            throw new BusinessException(String.format(
                    "El cambio (RD$ %.2f) supera el efectivo recibido (RD$ %.2f). "
                            + "El vuelto solo puede devolverse del efectivo entregado por el cliente.",
                    cambio, efectivoRecibido));
        }

        venta.setMontoRecibido(normalizar(totalPagado));
        venta.setCambio(cambio);

        // ── 10. Persistir venta ──────────────────────────────────────────
        Venta ventaGuardada = ventaRepository.save(venta);

        List<CambioInventario> cambiosInventario = existenciasBloqueadas.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> CambioInventario.salida(
                        entry.getValue().getProducto(),
                        saldosAnteriores.get(entry.getKey()),
                        entry.getValue().getCantidadActual()))
                .toList();
        trazabilidadInventarioService.registrar(
                "VENTA", almacen, null,
                ventaGuardada.getNumeroControl(),
                "Salida de inventario por venta",
                username,
                cambiosInventario);

        // ── 11. Actualizar cuadre del turno ──────────────────────────────
        actualizarCuadreTurno(turno);

        return mapToResponseDTO(ventaGuardada);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  3. CONSULTAS
    // ═════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public VentaResponseDTO buscarPorId(Long id) {
        Venta venta = ventaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada con id: " + id));
        return mapToResponseDTO(venta);
    }

    /**
     * Página del Historial de Ventas con los filtros ya aplicados en la base.
     * <p>
     * El orden lo fija el servicio y no el cliente: descendente por
     * {@code idVenta}, que además de ser el orden natural del historial es
     * único, así que ninguna fila puede repetirse o desaparecer al pasar de
     * página.
     */
    @Transactional(readOnly = true)
    public Page<VentaResumenDTO> listar(VentaFiltroDTO filtro, Pageable pageable) {
        LocalDateTime desde = filtro.fechaDesde() != null ? filtro.fechaDesde().atStartOfDay() : null;
        // El día de `fechaHasta` cuenta entero: una venta de las 23:45 sigue
        // perteneciendo a esa fecha.
        LocalDateTime hasta = filtro.fechaHasta() != null ? filtro.fechaHasta().atTime(LocalTime.MAX) : null;

        if (desde != null && hasta != null && desde.isAfter(hasta)) {
            throw new ParametroInvalidoException(
                    "El rango de fechas es inválido: fechaDesde no puede ser posterior a fechaHasta.");
        }

        String q = limpiar(filtro.q());
        String cajero = limpiar(filtro.cajero());

        Pageable orden = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "idVenta"));

        return ventaRepository.buscarResumen(
                q != null ? "%" + q.toLowerCase() + "%" : null,
                desde,
                hasta,
                cajero != null ? cajero.toLowerCase() : null,
                parsearMetodoPago(filtro.metodoPago()),
                orden);
    }

    /** Un filtro en blanco es un filtro ausente. */
    private String limpiar(String valor) {
        if (valor == null) return null;
        String texto = valor.trim();
        return texto.isEmpty() ? null : texto;
    }

    private MetodoPago parsearMetodoPago(String valor) {
        String texto = limpiar(valor);
        if (texto == null) return null;
        try {
            return MetodoPago.valueOf(texto.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ParametroInvalidoException("Método de pago desconocido: " + texto);
        }
    }

    @Transactional(readOnly = true)
    public String obtenerSiguienteNumero() {
        Long seq = ventaRepository.obtenerSiguienteNumeroControl();
        return String.format("VT-%06d", seq);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: Control de concurrencia sobre existencias
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Bloquea las existencias implicadas en la venta y valida que alcancen.
     * <p>
     * Sin bloqueo, validar y decrementar es un check-then-act: dos ventas
     * simultáneas leen la misma cantidad, ambas la consideran suficiente y
     * ambas confirman, dejando el inventario sobrevendido (ISSUE-004). El
     * bloqueo de fila serializa a las transacciones: la segunda espera al commit
     * de la primera y luego re-lee la cantidad ya descontada, por lo que su
     * validación falla con un error de negocio en vez de sobrevender.
     * <p>
     * Se bloquea la existencia exacta de {@code (idProducto, idAlmacen)}: el
     * almacén viene fijo por venta (derivado de la caja del turno, ver
     * {@link #procesarVenta}), así que nunca se toma "la primera" existencia
     * del producto entre varios almacenes (ISSUE-007). Si el producto no tiene
     * existencia registrada en ese almacén, la venta falla aunque otro almacén
     * sí tenga stock.
     * <p>
     * Los bloqueos se toman en orden ascendente de {@code idProducto} para que
     * todas las ventas los adquieran en la misma secuencia y no se produzcan
     * deadlocks entre carritos con los mismos productos en distinto orden. Las
     * cantidades se agregan por producto para cubrir carritos con líneas
     * repetidas del mismo artículo.
     *
     * @return existencia bloqueada por id de producto, lista para decrementar
     */
    private Map<Long, Existencia> bloquearYValidarStock(List<DetalleVentaRequestDTO> detalles, Long idAlmacen) {
        Map<Long, Integer> cantidadPorProducto = new TreeMap<>();
        for (DetalleVentaRequestDTO item : detalles) {
            cantidadPorProducto.merge(item.getIdProducto(), item.getCantidad(), Integer::sum);
        }

        Map<Long, Existencia> bloqueadas = new HashMap<>();
        for (Map.Entry<Long, Integer> entry : cantidadPorProducto.entrySet()) {
            Long idProducto = entry.getKey();
            int cantidadSolicitada = entry.getValue();

            Producto producto = productoRepository.findById(idProducto)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + idProducto));

            Existencia existencia = existenciaLockService
                    .bloquear(idProducto, idAlmacen)
                    .orElseThrow(() -> new BusinessException(String.format(
                            "No hay existencia registrada para '%s' en el almacén de esta caja.",
                            producto.getNombre())));

            if (existencia.getCantidadActual() < cantidadSolicitada) {
                throw new BusinessException(String.format(
                        "Stock insuficiente para '%s'. Disponible: %d, Solicitado: %d",
                        producto.getNombre(), existencia.getCantidadActual(), cantidadSolicitada));
            }

            bloqueadas.put(idProducto, existencia);
        }
        return bloqueadas;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: Motor de precios por línea
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Calcula el precio, descuentos y oferta para una línea del carrito.
     * Aplica las reglas de negocio:
     * <ol>
     *   <li>Si tiene oferta activa → precio detalle + descuento de oferta (mayorista invalidado)</li>
     *   <li>Si mayorista permitido + solicitado + cantidad >= mínimo → precio mayor</li>
     *   <li>En cualquier otro caso → precio detalle</li>
     * </ol>
     */
    private DetalleRecalculadoDTO calcularLineaDetalle(
            Producto producto, int cantidad, BigDecimal descuentoLineaPct,
            boolean solicitaMayor, boolean mayorPermitidoGlobal) {

        DetalleRecalculadoDTO dto = new DetalleRecalculadoDTO();
        dto.setIdProducto(producto.getIdProducto());
        dto.setIdCategoria(producto.getCategoria().getIdCategoria());
        dto.setCodigoProducto(producto.getSku());
        dto.setNombreProducto(producto.getNombre());
        dto.setCantidad(cantidad);
        dto.setTasaItbis(producto.getTasaItbis());
        dto.setDescuentoLinea(descuentoLineaPct != null ? descuentoLineaPct : BigDecimal.ZERO);

        BigDecimal precioDetalle = producto.getPrecioVenta();
        BigDecimal precioMayor = producto.getPrecioVentaMayor();

        // ── Verificar oferta activa ──────────────────────────────────────
        List<Oferta> ofertasVigentes = ofertaRepository.findVigentesPorProducto(
                producto.getIdProducto(), LocalDate.now());

        BigDecimal descuentoOferta = BigDecimal.ZERO;
        String ofertaAplicadaNombre = null;

        if (!ofertasVigentes.isEmpty()) {
            // Si tiene oferta activa → invalidar precio mayorista para este item
            Oferta oferta = ofertasVigentes.get(0); // tomar la primera vigente

            if ("CANTIDAD".equals(oferta.getTipo()) && oferta.getOfertaCantidad() != null) {
                OfertaCantidad oc = oferta.getOfertaCantidad();
                // Ej: 3x2 → cantidadRequerida=3, cantidadPagada=2
                int gruposCompletos = cantidad / oc.getCantidadRequerida();
                int itemsRestantes = cantidad % oc.getCantidadRequerida();
                int itemsAPagar = (gruposCompletos * oc.getCantidadPagada()) + itemsRestantes;
                int itemsGratis = cantidad - itemsAPagar;
                descuentoOferta = precioDetalle.multiply(BigDecimal.valueOf(itemsGratis));
                ofertaAplicadaNombre = oferta.getNombre();
            } else if ("DESCUENTO".equals(oferta.getTipo()) && oferta.getOfertaDescuento() != null) {
                OfertaDescuento od = oferta.getOfertaDescuento();
                descuentoOferta = precioDetalle.multiply(BigDecimal.valueOf(cantidad))
                        .multiply(od.getPorcentajeDescuento())
                        .divide(CIEN, 2, RoundingMode.HALF_UP);
                ofertaAplicadaNombre = oferta.getNombre();
            }

            // Oferta activa → siempre precio detalle
            dto.setPrecioUnitario(precioDetalle);
            dto.setTipoPrecio(DETALLE);

            // Si el cajero había solicitado mayor, marcamos recálculo
            if (solicitaMayor && precioMayor.compareTo(BigDecimal.ZERO) > 0) {
                dto.setRecalculado(true);
                dto.setPrecioUnitarioOriginal(precioMayor);
                dto.setMensajeRecalculo(String.format(
                        "Oferta '%s' activa: precio al por mayor RD$%.2f invalidado, se aplica precio detalle RD$%.2f",
                        ofertaAplicadaNombre, precioMayor, precioDetalle));
            }

        } else if (solicitaMayor && mayorPermitidoGlobal
                && precioMayor.compareTo(BigDecimal.ZERO) > 0
                && cantidad >= producto.getCantidadMinimaMayor()) {
            // ── Precio mayorista válido ──────────────────────────────────
            dto.setPrecioUnitario(precioMayor);
            dto.setTipoPrecio(MAYOR);

        } else {
            // ── Precio detalle (caso por defecto) ────────────────────────
            dto.setPrecioUnitario(precioDetalle);
            dto.setTipoPrecio(DETALLE);

            // Si el cajero solicitó mayor pero fue rechazado por regla
            if (solicitaMayor && precioMayor.compareTo(BigDecimal.ZERO) > 0) {
                dto.setRecalculado(true);
                dto.setPrecioUnitarioOriginal(precioMayor);

                if (!mayorPermitidoGlobal) {
                    dto.setMensajeRecalculo(String.format(
                            "De precio al por mayor RD$%.2f cambió a precio detalle RD$%.2f (método de pago o NCF no compatible)",
                            precioMayor, precioDetalle));
                } else if (cantidad < producto.getCantidadMinimaMayor()) {
                    dto.setMensajeRecalculo(String.format(
                            "De precio al por mayor RD$%.2f cambió a precio detalle RD$%.2f (cantidad mínima: %d unidades)",
                            precioMayor, precioDetalle, producto.getCantidadMinimaMayor()));
                }
            }
        }

        dto.setDescuentoOferta(normalizar(descuentoOferta));
        dto.setOfertaAplicada(ofertaAplicadaNombre);

        // ── Calcular importe ─────────────────────────────────────────────
        BigDecimal importeBruto = dto.getPrecioUnitario().multiply(BigDecimal.valueOf(cantidad));

        // Descuento por línea (%)
        BigDecimal montoDescuentoLinea = BigDecimal.ZERO;
        if (dto.getDescuentoLinea().compareTo(BigDecimal.ZERO) > 0) {
            montoDescuentoLinea = importeBruto
                    .multiply(dto.getDescuentoLinea())
                    .divide(CIEN, 2, RoundingMode.HALF_UP);
        }

        BigDecimal importeNeto = importeBruto
                .subtract(montoDescuentoLinea)
                .subtract(descuentoOferta);

        dto.setImporte(normalizar(importeNeto.max(BigDecimal.ZERO)));

        return dto;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LÓGICA PRIVADA: ITBIS por línea (ISSUE-008)
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Rechaza en el POS los tipos de comprobante que no corresponden a una
     * venta. Un {@code tipoNcf} nulo o en blanco sigue siendo válido: significa
     * venta sin comprobante fiscal y no consume secuencia.
     */
    private void validarTipoNcfDeVenta(String tipoNcf) {
        if (tipoNcf == null || tipoNcf.isBlank()) {
            return;
        }
        if (!TIPOS_NCF_VENTA.contains(tipoNcf.trim().toUpperCase())) {
            throw new BusinessException(String.format(
                    "El tipo de NCF '%s' no puede emitirse desde una venta. Permitidos: B01, B02, B14, B15. "
                            + "B04 corresponde a Notas de Crédito y solo lo emite una devolución.",
                    tipoNcf));
        }
    }

    /**
     * Rechaza descuentos fuera de rango antes de cualquier efecto secundario
     * (bloqueo de stock, generación de NCF, cuadre de caja).
     */
    private void validarDescuentos(BigDecimal descuentoGlobal, List<DetalleVentaRequestDTO> detalles) {
        if (descuentoGlobal != null && descuentoGlobal.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("El descuento global no puede ser negativo.");
        }
        for (DetalleVentaRequestDTO item : detalles) {
            BigDecimal descuentoLinea = item.getDescuentoLinea();
            if (descuentoLinea != null
                    && (descuentoLinea.compareTo(BigDecimal.ZERO) < 0 || descuentoLinea.compareTo(CIEN) > 0)) {
                throw new BusinessException(String.format(
                        "El descuento de línea para el producto id %d debe estar entre 0 y 100.",
                        item.getIdProducto()));
            }
        }
    }

    private record TotalesVenta(
            BigDecimal subtotal, BigDecimal itbis, BigDecimal total,
            BigDecimal descuentoGlobalAplicado, BigDecimal descuentoCuponAplicado) {}

    /** Resuelve el cupón (preview o venta real, según el caller) para un conjunto de líneas ya netas de descuento global. */
    @FunctionalInterface
    private interface ResolutorCupon {
        CuponAplicadoDTO resolver(String codigoSecreto, List<LineaParaCuponDTO> lineas);
    }

    /**
     * Orden explícito de descuentos (ISSUE-008):
     * <ol>
     *   <li>Descuento de línea + oferta — ya aplicado en {@code importe}
     *       (ver {@link #calcularLineaDetalle}).</li>
     *   <li>Descuento global, prorrateado entre TODAS las líneas.</li>
     *   <li>Cupón, calculado y prorrateado ÚNICAMENTE entre las líneas cuya
     *       categoría está habilitada por el cupón — una línea de categoría
     *       no elegible nunca recibe descuento de cupón, aunque exista algún
     *       producto elegible en el resto del carrito.</li>
     * </ol>
     * Ningún descuento puede dejar una línea negativa (se clampea a cero).
     * Base imponible e ITBIS se calculan por línea con la tasa propia de
     * cada producto, sobre el importe neto tras los tres descuentos:
     * {@code base_i + itbis_i == importeNeto_i} siempre, por construcción
     * (itbis es el resto, nunca se redondea de forma independiente), así que
     * {@code subtotal + itbis == total} reconcilia exacto al centavo.
     * <p>
     * {@code descuentoGlobalAplicado}/{@code descuentoCuponAplicado} son los
     * montos REALMENTE aplicados (tras limitar al importe disponible), no
     * los solicitados — su suma nunca supera el importe del carrito.
     */
    private TotalesVenta calcularTotalesConItbisPorLinea(
            List<DetalleRecalculadoDTO> detalles, BigDecimal descuentoGlobal,
            String codigoCupon, ResolutorCupon resolutorCupon) {

        int n = detalles.size();
        List<BigDecimal> importes = detalles.stream().map(DetalleRecalculadoDTO::getImporte).toList();
        BigDecimal importeLineasTotal = importes.stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── 1. Descuento global, prorrateado entre TODAS las líneas ──────
        BigDecimal descuentoGlobalAplicado = valor(descuentoGlobal).max(BigDecimal.ZERO).min(importeLineasTotal);
        BigDecimal[] descuentoGlobalPorLinea =
                prorratearPorMayorResto(importes, importeLineasTotal, descuentoGlobalAplicado);

        BigDecimal[] importeTrasGlobal = new BigDecimal[n];
        for (int i = 0; i < n; i++) {
            importeTrasGlobal[i] = importes.get(i).subtract(descuentoGlobalPorLinea[i]).max(BigDecimal.ZERO);
        }

        // ── 2. Cupón, resuelto y prorrateado solo entre líneas elegibles ──
        BigDecimal descuentoCuponAplicado = BigDecimal.ZERO;
        BigDecimal[] descuentoCuponPorLinea = new BigDecimal[n];
        Arrays.fill(descuentoCuponPorLinea, BigDecimal.ZERO);

        if (codigoCupon != null && !codigoCupon.isBlank()) {
            List<LineaParaCuponDTO> lineasParaCupon = new ArrayList<>(n);
            for (int i = 0; i < n; i++) {
                lineasParaCupon.add(new LineaParaCuponDTO(detalles.get(i).getIdCategoria(), importeTrasGlobal[i]));
            }
            CuponAplicadoDTO cupon = resolutorCupon.resolver(codigoCupon, lineasParaCupon);
            descuentoCuponAplicado = cupon.getMontoDescontado();

            List<Integer> indicesElegibles = cupon.getIndicesLineasElegibles();
            BigDecimal baseElegible = indicesElegibles.stream()
                    .map(i -> importeTrasGlobal[i]).reduce(BigDecimal.ZERO, BigDecimal::add);
            List<BigDecimal> importesElegibles = indicesElegibles.stream().map(i -> importeTrasGlobal[i]).toList();
            BigDecimal[] descuentosElegibles =
                    prorratearPorMayorResto(importesElegibles, baseElegible, descuentoCuponAplicado);
            for (int k = 0; k < indicesElegibles.size(); k++) {
                descuentoCuponPorLinea[indicesElegibles.get(k)] = descuentosElegibles[k];
            }
        }

        // ── 3. Importe neto final, base e ITBIS por línea ─────────────────
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal itbis = BigDecimal.ZERO;
        for (int i = 0; i < n; i++) {
            DetalleRecalculadoDTO d = detalles.get(i);
            BigDecimal descuentoProrrateadoLinea = descuentoGlobalPorLinea[i].add(descuentoCuponPorLinea[i]);
            BigDecimal importeNeto = importeTrasGlobal[i].subtract(descuentoCuponPorLinea[i]).max(BigDecimal.ZERO);

            BigDecimal tasa = valor(d.getTasaItbis());
            BigDecimal factor = BigDecimal.ONE.add(tasa.divide(CIEN, 10, RoundingMode.HALF_UP));
            BigDecimal base = importeNeto.divide(factor, 2, RoundingMode.HALF_UP);
            BigDecimal itbisLinea = importeNeto.subtract(base);

            d.setDescuentoProrrateado(descuentoProrrateadoLinea);
            d.setBaseImponible(base);
            d.setItbisLinea(itbisLinea);

            subtotal = subtotal.add(base);
            itbis = itbis.add(itbisLinea);
        }

        return new TotalesVenta(subtotal, itbis, subtotal.add(itbis), descuentoGlobalAplicado, descuentoCuponAplicado);
    }

    /**
     * Reparte {@code montoAProrratear} entre {@code importes}, proporcional
     * al valor de cada uno, usando el método del mayor resto: cada línea
     * recibe el piso de su parte exacta y los centavos que sobran (siempre
     * menos que el número de líneas) se entregan de a uno a las líneas con
     * mayor resto fraccionario. Así la suma de los montos repartidos es
     * exactamente {@code montoAProrratear} — nunca se pierde ni se gana un
     * centavo, y ninguna línea recibe más de lo que su propio importe puede
     * absorber cuando {@code montoAProrratear <= importeTotal}.
     */
    private BigDecimal[] prorratearPorMayorResto(
            List<BigDecimal> importes, BigDecimal importeTotal, BigDecimal montoAProrratear) {

        int n = importes.size();
        BigDecimal[] montosPorLinea = new BigDecimal[n];

        if (n == 0 || importeTotal.compareTo(BigDecimal.ZERO) == 0 || montoAProrratear.compareTo(BigDecimal.ZERO) == 0) {
            Arrays.fill(montosPorLinea, BigDecimal.ZERO);
            return montosPorLinea;
        }

        BigDecimal[] exactas = new BigDecimal[n];
        BigDecimal[] restos = new BigDecimal[n];
        BigDecimal sumaPisos = BigDecimal.ZERO;
        for (int i = 0; i < n; i++) {
            BigDecimal exacta = montoAProrratear.multiply(importes.get(i))
                    .divide(importeTotal, 10, RoundingMode.DOWN);
            BigDecimal piso = exacta.setScale(2, RoundingMode.DOWN);
            exactas[i] = exacta;
            montosPorLinea[i] = piso;
            restos[i] = exacta.subtract(piso);
            sumaPisos = sumaPisos.add(piso);
        }

        int centavosRestantes = montoAProrratear.subtract(sumaPisos)
                .movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValueExact();

        List<Integer> orden = IntStream.range(0, n).boxed()
                .sorted((a, b) -> restos[b].compareTo(restos[a]))
                .toList();

        for (int i = 0; i < centavosRestantes && i < orden.size(); i++) {
            int idx = orden.get(i);
            montosPorLinea[idx] = montosPorLinea[idx].add(new BigDecimal("0.01"));
        }

        return montosPorLinea;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Recalcula el cuadre del turno a partir de las ventas confirmadas.
     * <p>
     * El efectivo se cuenta <b>neto</b>: lo recibido menos el cambio devuelto.
     * Sumar solo los ingresos en efectivo contaba como dinero en caja el vuelto
     * que ya había salido del cajón, e inflaba el monto esperado — una venta de
     * RD$130 pagada con RD$200 subía el turno RD$200 y dejaba al cajero con un
     * faltante de RD$70 al cerrar (ISSUE-006).
     * <p>
     * Los métodos no efectivos no se ajustan: el cambio nunca se devuelve por
     * el POS ni por el banco, siempre sale del efectivo.
     */
    private void actualizarCuadreTurno(TurnoCaja turno) {
        Long idTurno = turno.getIdTurnoCaja();
        BigDecimal efectivoRecibido = ventaRepository.sumarVentasEfectivoPorTurno(idTurno);
        BigDecimal cambioEntregado = ventaRepository.sumarCambioEntregadoPorTurno(idTurno);
        turno.setTotalVentasEfectivo(normalizar(efectivoRecibido.subtract(cambioEntregado)));
        turno.setTotalVentasTarjeta(ventaRepository.sumarVentasTarjetaPorTurno(idTurno));
        turno.setTotalVentasTransferencia(ventaRepository.sumarVentasTransferenciaPorTurno(idTurno));
        turno.setTotalVentasCheque(ventaRepository.sumarVentasChequePorTurno(idTurno));

        // El efectivo devuelto por notas de crédito ya salió del cajón y vive en
        // el turno: restarlo aquí evita que una venta posterior borre el ajuste
        // que hizo la devolución.
        BigDecimal montoEsperado = turno.getMontoInicial()
                .add(turno.getTotalVentasEfectivo())
                .add(valor(turno.getTotalOtrosIngresos()))
                .subtract(valor(turno.getTotalEgresos()))
                .subtract(valor(turno.getTotalDevolucionesEfectivo()));
        turno.setMontoEsperado(normalizar(montoEsperado));

        turnoCajaRepository.save(turno);
    }

    /**
     * Exige que el método de pago principal describa realmente cómo se cobró.
     * <p>
     * Sin esta validación el POS aceptaba una venta declarada como EFECTIVO
     * cobrada con un ingreso TARJETA: el cuadre repartía el dinero por los
     * ingresos y el reporte por el principal, así que los dos se contradecían
     * (ISSUE-006). {@code MIXTO} es un resumen, no una forma de cobro, y por eso
     * no puede aparecer en un ingreso individual.
     */
    private void validarComposicionPagos(MetodoPago principal, List<IngresoVentaRequestDTO> ingresos) {
        Set<MetodoPago> metodosCobrados = new LinkedHashSet<>();
        for (IngresoVentaRequestDTO ingreso : ingresos) {
            MetodoPago metodoIngreso = parseMetodoPago(ingreso.getMetodoPago());
            if (metodoIngreso == MetodoPago.MIXTO) {
                throw new BusinessException(
                        "MIXTO no es una forma de cobro: cada ingreso debe declarar el método real "
                                + "(EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE o CUPON).");
            }
            metodosCobrados.add(metodoIngreso);
        }

        if (principal == MetodoPago.MIXTO) {
            if (metodosCobrados.size() < 2) {
                throw new BusinessException(
                        "Una venta MIXTA requiere al menos dos métodos de cobro distintos. Recibido: "
                                + metodosCobrados);
            }
            return;
        }

        if (metodosCobrados.size() > 1) {
            throw new BusinessException(String.format(
                    "La venta declara método principal %s pero se cobró con varios métodos %s. "
                            + "Use MIXTO como método principal.",
                    principal, metodosCobrados));
        }

        if (!metodosCobrados.contains(principal)) {
            throw new BusinessException(String.format(
                    "El método de pago principal (%s) no coincide con el cobro registrado %s.",
                    principal, metodosCobrados));
        }
    }

    private MetodoPago parseMetodoPago(String metodo) {
        try {
            return MetodoPago.valueOf(metodo.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Método de pago inválido: " + metodo
                    + ". Valores permitidos: EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE, MIXTO");
        }
    }

    private BigDecimal normalizar(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal valor(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  MAPPER: Entidad → Response DTO
    // ═════════════════════════════════════════════════════════════════════

    private VentaResponseDTO mapToResponseDTO(Venta venta) {
        VentaResponseDTO dto = new VentaResponseDTO();
        dto.setIdVenta(venta.getIdVenta());
        dto.setIdTurnoCaja(venta.getTurnoCaja().getIdTurnoCaja());
        dto.setCajeroNombre(venta.getUsuario().getUsername());
        if (venta.getAlmacen() != null) {
            dto.setIdAlmacen(venta.getAlmacen().getIdAlmacen());
            dto.setAlmacenNombre(venta.getAlmacen().getNombre());
        }
        dto.setIdCliente(venta.getCliente() != null ? venta.getCliente().getIdCliente() : null);
        dto.setClienteNombre(venta.getCliente() != null ? venta.getCliente().getNombreCompleto() : null);
        dto.setClienteRncCedula(venta.getCliente() != null ? venta.getCliente().getRncCedula() : null);
        dto.setNombreClienteTemporal(venta.getNombreClienteTemporal());
        dto.setRncTemporal(venta.getRncTemporal());
        dto.setNumeroControl(venta.getNumeroControl());
        dto.setNcf(venta.getNcf());
        dto.setTipoNcf(venta.getTipoNcf());
        dto.setMetodoPagoPrincipal(venta.getMetodoPagoPrincipal().name());
        dto.setUsaPrecioMayor(venta.isUsaPrecioMayor());
        dto.setSubtotal(venta.getSubtotal());
        dto.setDescuentoTotal(venta.getDescuentoTotal());
        dto.setItbis(venta.getItbis());
        dto.setTotal(venta.getTotal());
        dto.setMontoRecibido(venta.getMontoRecibido());
        dto.setCambio(venta.getCambio());
        dto.setCodigoCupon(venta.getCodigoCupon());
        dto.setDescuentoCupon(venta.getDescuentoCupon());
        dto.setEstado(venta.getEstado());
        dto.setFechaVenta(venta.getFechaVenta());

        // Detalles
        dto.setDetalles(venta.getDetalles().stream().map(d -> {
            VentaResponseDTO.DetalleVentaResponseDTO det = new VentaResponseDTO.DetalleVentaResponseDTO();
            det.setIdDetalleVenta(d.getIdDetalleVenta());
            det.setIdProducto(d.getProducto().getIdProducto());
            det.setSkuProducto(d.getProducto().getSku());
            det.setNombreProducto(d.getProducto().getNombre());
            det.setCantidad(d.getCantidad());
            det.setPrecioUnitario(d.getPrecioUnitario());
            det.setPrecioUnitarioOriginal(d.getPrecioUnitarioOriginal());
            det.setTipoPrecio(d.getTipoPrecio());
            det.setTasaItbis(d.getTasaItbis());
            det.setDescuentoLinea(d.getDescuentoLinea());
            det.setDescuentoOferta(d.getDescuentoOferta());
            det.setOfertaAplicada(d.getOfertaAplicada());
            det.setImporte(d.getImporte());
            det.setDescuentoProrrateado(d.getDescuentoProrrateado());
            det.setBaseImponible(d.getBaseImponible());
            det.setItbisLinea(d.getItbisLinea());
            return det;
        }).toList());

        // Ingresos
        dto.setIngresos(venta.getIngresos().stream().map(i -> {
            VentaResponseDTO.IngresoVentaResponseDTO ing = new VentaResponseDTO.IngresoVentaResponseDTO();
            ing.setIdIngresoVenta(i.getIdIngresoVenta());
            ing.setMetodoPago(i.getMetodoPago().name());
            ing.setMonto(i.getMonto());
            ing.setReferencia(i.getReferencia());
            ing.setFechaRegistro(i.getFechaRegistro());
            return ing;
        }).toList());

        return dto;
    }
}
