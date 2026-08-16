package com.maxli.venta.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.cliente.entity.Cliente;
import com.maxli.cliente.repository.ClienteRepository;
import com.maxli.cupon.service.CuponService;
import com.maxli.cupon.dto.CuponAplicadoDTO;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
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
import com.maxli.venta.dto.VentaResponseDTO;
import com.maxli.venta.entity.DetalleVenta;
import com.maxli.venta.entity.IngresoVenta;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import com.maxli.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

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

    private final VentaRepository ventaRepository;
    private final TurnoCajaRepository turnoCajaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProductoRepository productoRepository;
    private final ExistenciaRepository existenciaRepository;
    private final OfertaRepository ofertaRepository;
    private final NcfService ncfService;
    private final CuponService cuponService;
    private final ClienteRepository clienteRepository;

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

        BigDecimal importeLineasTotal = BigDecimal.ZERO;
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

            importeLineasTotal = importeLineasTotal.add(detalle.getImporte());
            descuentoTotal = descuentoTotal.add(
                    detalle.getDescuentoOferta() != null ? detalle.getDescuentoOferta() : BigDecimal.ZERO);

            detallesRecalculados.add(detalle);
        }

        BigDecimal descuentoGlobal = request.getDescuentoGlobal() != null
                ? request.getDescuentoGlobal() : BigDecimal.ZERO;
        BigDecimal totalVenta = normalizar(importeLineasTotal.subtract(descuentoGlobal).max(BigDecimal.ZERO));
        BigDecimal subtotalSinItbis = totalVenta.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP);
        BigDecimal itbisCalculado = totalVenta.subtract(subtotalSinItbis);

        response.setDetalles(detallesRecalculados);
        response.setSubtotal(subtotalSinItbis);
        response.setDescuentoTotal(normalizar(descuentoTotal.add(descuentoGlobal)));
        response.setItbis(itbisCalculado);
        response.setTotal(totalVenta);
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
        // ── 1. Validar turno abierto ─────────────────────────────────────
        if (request.getIdTurnoCaja() == null) {
            throw new BusinessException("No se puede procesar la venta: se requiere un turno de caja abierto.");
        }

        TurnoCaja turno = turnoCajaRepository.findById(request.getIdTurnoCaja())
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

        // ── 5. Generar NCF ───────────────────────────────────────────────
        if (request.getTipoNcf() != null && !request.getTipoNcf().isBlank()) {
            NcfGeneradoDTO ncfGenerado = ncfService.generarSiguienteNcf(request.getTipoNcf());
            venta.setNcf(ncfGenerado.getNcfCompleto());
        }

        // ── 6. Procesar líneas de detalle ────────────────────────────────
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal itbisTotal = BigDecimal.ZERO;
        BigDecimal descuentoTotal = BigDecimal.ZERO;
        List<Long> idsCategorias = new ArrayList<>();

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

            // Crear entidad detalle
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

            subtotal = subtotal.add(calc.getImporte());
            descuentoTotal = descuentoTotal.add(
                    calc.getDescuentoOferta() != null ? calc.getDescuentoOferta() : BigDecimal.ZERO);

            idsCategorias.add(producto.getCategoria().getIdCategoria());

            // Decrementar stock
            existencia.setCantidadActual(existencia.getCantidadActual() - item.getCantidad());
            existenciaRepository.save(existencia);
        }

        // ── 7. Descuento global ──────────────────────────────────────────
        BigDecimal descuentoGlobal = request.getDescuentoGlobal() != null
                ? request.getDescuentoGlobal() : BigDecimal.ZERO;
        BigDecimal importeTotalConDescuento = subtotal.subtract(descuentoGlobal);
        descuentoTotal = descuentoTotal.add(descuentoGlobal);

        // ── 8. Validar y aplicar cupón ───────────────────────────────────
        BigDecimal descuentoCupon = BigDecimal.ZERO;
        if (request.getCodigoCupon() != null && !request.getCodigoCupon().isBlank()) {
            CuponAplicadoDTO cupon = cuponService.validarYAplicarCupon(
                    request.getCodigoCupon(), idsCategorias, subtotal);
            descuentoCupon = cupon.getMontoDescontado();
            venta.setCodigoCupon(request.getCodigoCupon());
            venta.setDescuentoCupon(descuentoCupon);
            importeTotalConDescuento = importeTotalConDescuento.subtract(descuentoCupon);
            descuentoTotal = descuentoTotal.add(descuentoCupon);
        }

        BigDecimal totalVenta = normalizar(importeTotalConDescuento.max(BigDecimal.ZERO));
        BigDecimal subtotalSinItbis = totalVenta.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP);
        BigDecimal itbisTotalCalculado = totalVenta.subtract(subtotalSinItbis);

        venta.setSubtotal(subtotalSinItbis);
        venta.setDescuentoTotal(normalizar(descuentoTotal));
        venta.setItbis(itbisTotalCalculado);
        venta.setTotal(totalVenta);



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

    @Transactional(readOnly = true)
    public Page<VentaResponseDTO> listar(Pageable pageable) {
        return ventaRepository.findAll(pageable).map(this::mapToResponseDTO);
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

            Existencia existencia = existenciaRepository
                    .bloquearPorProductoYAlmacenParaActualizar(idProducto, idAlmacen)
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

        BigDecimal montoEsperado = turno.getMontoInicial()
                .add(turno.getTotalVentasEfectivo())
                .add(valor(turno.getTotalOtrosIngresos()))
                .subtract(valor(turno.getTotalEgresos()));
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
