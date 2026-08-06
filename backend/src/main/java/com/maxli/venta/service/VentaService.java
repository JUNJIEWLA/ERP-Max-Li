package com.maxli.venta.service;

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
import java.util.List;

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
     *   <li>Validar stock de todos los items</li>
     *   <li>Recalcular precios según reglas</li>
     *   <li>Aplicar ofertas vigentes</li>
     *   <li>Validar y aplicar cupón</li>
     *   <li>Generar NCF</li>
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

        // ── 2. Parsear método de pago ────────────────────────────────────
        MetodoPago metodo = parseMetodoPago(request.getMetodoPago());
        boolean esB01 = B01.equalsIgnoreCase(request.getTipoNcf());
        boolean mayorPermitido = metodo.isAplicaParaMayorista() && !esB01;
        if (metodo == MetodoPago.MIXTO) {
            mayorPermitido = false;
        }

        // ── 3. Crear la venta ────────────────────────────────────────────
        Venta venta = new Venta();
        venta.setTurnoCaja(turno);
        venta.setUsuario(usuario);
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

        // ── 4. Generar NCF ───────────────────────────────────────────────
        if (request.getTipoNcf() != null && !request.getTipoNcf().isBlank()) {
            NcfGeneradoDTO ncfGenerado = ncfService.generarSiguienteNcf(request.getTipoNcf());
            venta.setNcf(ncfGenerado.getNcfCompleto());
        }

        // ── 5. Procesar líneas de detalle ────────────────────────────────
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal itbisTotal = BigDecimal.ZERO;
        BigDecimal descuentoTotal = BigDecimal.ZERO;
        List<Long> idsCategorias = new ArrayList<>();

        for (DetalleVentaRequestDTO item : request.getDetalles()) {
            Producto producto = productoRepository.findById(item.getIdProducto())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado con id: " + item.getIdProducto()));

            // Validar stock
            Existencia existencia = existenciaRepository.findFirstByProducto_IdProducto(producto.getIdProducto())
                    .orElseThrow(() -> new BusinessException(
                            "No hay registro de existencia para el producto: " + producto.getNombre()));

            if (existencia.getCantidadActual() < item.getCantidad()) {
                throw new BusinessException(String.format(
                        "Stock insuficiente para '%s'. Disponible: %d, Solicitado: %d",
                        producto.getNombre(), existencia.getCantidadActual(), item.getCantidad()));
            }

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

        // ── 6. Descuento global ──────────────────────────────────────────
        BigDecimal descuentoGlobal = request.getDescuentoGlobal() != null
                ? request.getDescuentoGlobal() : BigDecimal.ZERO;
        BigDecimal importeTotalConDescuento = subtotal.subtract(descuentoGlobal);
        descuentoTotal = descuentoTotal.add(descuentoGlobal);

        // ── 7. Validar y aplicar cupón ───────────────────────────────────
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



        // ── 8. Registrar ingresos (pagos) ────────────────────────────────
        BigDecimal totalPagado = BigDecimal.ZERO;
        for (IngresoVentaRequestDTO ingresoDto : request.getIngresos()) {
            MetodoPago metodoPagoIngreso = parseMetodoPago(ingresoDto.getMetodoPago());
            IngresoVenta ingreso = new IngresoVenta();
            ingreso.setMetodoPago(metodoPagoIngreso);
            ingreso.setMonto(ingresoDto.getMonto());
            ingreso.setReferencia(ingresoDto.getReferencia());
            ingreso.setFechaRegistro(LocalDateTime.now());
            venta.addIngreso(ingreso);
            totalPagado = totalPagado.add(ingresoDto.getMonto());
        }

        if (totalPagado.compareTo(totalVenta) < 0) {
            throw new BusinessException(String.format(
                    "El monto pagado (RD$ %.2f) es menor al total de la venta (RD$ %.2f).",
                    totalPagado, totalVenta));
        }

        venta.setMontoRecibido(normalizar(totalPagado));
        venta.setCambio(normalizar(totalPagado.subtract(totalVenta)));

        // ── 9. Persistir venta ───────────────────────────────────────────
        Venta ventaGuardada = ventaRepository.save(venta);

        // ── 10. Actualizar cuadre del turno ──────────────────────────────
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

    private void actualizarCuadreTurno(TurnoCaja turno) {
        Long idTurno = turno.getIdTurnoCaja();
        turno.setTotalVentasEfectivo(ventaRepository.sumarVentasEfectivoPorTurno(idTurno));
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
