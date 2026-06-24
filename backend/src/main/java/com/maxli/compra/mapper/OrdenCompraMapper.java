package com.maxli.compra.mapper;

import com.maxli.compra.dto.DetalleOrdenCompraResponseDTO;
import com.maxli.compra.dto.OrdenCompraResponseDTO;
import com.maxli.compra.dto.PagoProveedorResponseDTO;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.entity.PagoProveedor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

@Component
public class OrdenCompraMapper {

    private static final Set<String> ESTADOS_ACTIVOS = Set.of("ENVIADA", "RECEPCION_PARCIAL");

    public OrdenCompraResponseDTO toDto(OrdenCompra orden) {
        OrdenCompraResponseDTO dto = new OrdenCompraResponseDTO();
        dto.setIdOrdenCompra(orden.getIdOrdenCompra());
        dto.setIdProveedor(orden.getProveedor().getIdProveedor());
        dto.setNombreProveedor(orden.getProveedor().getNombreEmpresa());
        dto.setTotal(orden.getTotal());
        dto.setEstado(orden.getEstado());
        dto.setFechaOrden(orden.getFechaOrden());
        dto.setFechaModificacion(orden.getFechaModificacion());
        dto.setFechaLlegadaAcordada(orden.getFechaLlegadaAcordada());

        // Calcular días de retraso solo si hay fecha acordada, la OC sigue activa y la fecha ya pasó
        if (orden.getFechaLlegadaAcordada() != null && ESTADOS_ACTIVOS.contains(orden.getEstado())) {
            long dias = ChronoUnit.DAYS.between(orden.getFechaLlegadaAcordada(), LocalDate.now());
            dto.setDiasRetraso(dias >= 0 ? (int) dias : null); // null si fecha aún no ha llegado
        }

        // Calcular totales de pago
        BigDecimal totalPagado = orden.getPagos().stream()
                .map(PagoProveedor::getMontoPagado)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalPagado(totalPagado);

        BigDecimal balance = orden.getTotal().subtract(totalPagado);
        dto.setBalancePendiente(balance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : balance);

        // Estado de pago calculado
        if (totalPagado.compareTo(BigDecimal.ZERO) == 0) {
            dto.setEstadoPago("PENDIENTE");
        } else if (totalPagado.compareTo(orden.getTotal()) >= 0) {
            dto.setEstadoPago("SALDADO");
        } else {
            dto.setEstadoPago("PARCIAL");
        }

        // Detalles
        dto.setDetalles(orden.getDetalles().stream()
                .map(this::toDetalleDto)
                .toList());

        // Pagos
        dto.setPagos(orden.getPagos().stream()
                .map(this::toPagoDto)
                .toList());

        return dto;
    }

    public DetalleOrdenCompraResponseDTO toDetalleDto(DetalleOrdenCompra detalle) {
        DetalleOrdenCompraResponseDTO dto = new DetalleOrdenCompraResponseDTO();
        dto.setIdDetalleOrdenCompra(detalle.getIdDetalleOrdenCompra());
        dto.setIdProducto(detalle.getProducto().getIdProducto());
        dto.setNombreProducto(detalle.getProducto().getNombre());
        dto.setSkuProducto(detalle.getProducto().getSku());
        dto.setCantidad(detalle.getCantidad());
        dto.setPrecioUnitario(detalle.getPrecioUnitario());
        dto.setSubtotal(detalle.getSubtotal());
        dto.setCantidadRecibida(detalle.getCantidadRecibida());
        dto.setCantidadPendiente(detalle.getCantidad() - detalle.getCantidadRecibida());
        if (detalle.getAlmacen() != null) {
            dto.setIdAlmacen(detalle.getAlmacen().getIdAlmacen());
            dto.setNombreAlmacen(detalle.getAlmacen().getNombre());
        }
        return dto;
    }

    public PagoProveedorResponseDTO toPagoDto(PagoProveedor pago) {
        PagoProveedorResponseDTO dto = new PagoProveedorResponseDTO();
        dto.setIdPagoProveedor(pago.getIdPagoProveedor());
        dto.setIdOrdenCompra(pago.getOrdenCompra().getIdOrdenCompra());
        dto.setMontoPagado(pago.getMontoPagado());
        dto.setMetodo(pago.getMetodo());
        dto.setNumeroReferencia(pago.getNumeroReferencia());
        dto.setFecha(pago.getFecha());
        return dto;
    }
}