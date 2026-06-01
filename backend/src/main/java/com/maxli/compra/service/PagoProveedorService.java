package com.maxli.compra.service;

import com.maxli.compra.dto.PagoProveedorRequestDTO;
import com.maxli.compra.dto.PagoProveedorResponseDTO;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.entity.PagoProveedor;
import com.maxli.compra.mapper.OrdenCompraMapper;
import com.maxli.compra.repository.PagoProveedorRepository;
import com.maxli.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PagoProveedorService {

    // Se puede pagar en cualquier estado activo (no anulada)
    private static final Set<String> ESTADOS_PAGABLES = Set.of(
            "ENVIADA", "RECEPCION_PARCIAL", "COMPLETADA"
    );

    private final PagoProveedorRepository pagoProveedorRepository;
    private final OrdenCompraService ordenCompraService;
    private final OrdenCompraMapper ordenCompraMapper;

    @Transactional(readOnly = true)
    public List<PagoProveedorResponseDTO> listarPorOrden(Long idOrdenCompra) {
        // Validar que la orden exista
        ordenCompraService.obtenerEntidadPorId(idOrdenCompra);
        return pagoProveedorRepository.findByOrdenCompra_IdOrdenCompra(idOrdenCompra)
                .stream()
                .map(ordenCompraMapper::toPagoDto)
                .toList();
    }

    @Transactional
    public PagoProveedorResponseDTO registrarPago(Long idOrdenCompra, PagoProveedorRequestDTO dto) {
        OrdenCompra orden = ordenCompraService.obtenerEntidadPorId(idOrdenCompra);

        if (!ESTADOS_PAGABLES.contains(orden.getEstado())) {
            throw new BusinessException(
                    "No se pueden registrar pagos en una orden con estado '" + orden.getEstado() + "'. " +
                    "La orden debe estar en: ENVIADA, RECEPCION_PARCIAL o COMPLETADA");
        }

        // Validar que el pago no exceda el balance pendiente
        BigDecimal totalPagado = pagoProveedorRepository.sumMontoPagadoPorOrden(idOrdenCompra);
        BigDecimal balance = orden.getTotal().subtract(totalPagado);

        if (dto.getMontoPagado().compareTo(balance) > 0) {
            throw new BusinessException(
                    "El monto a pagar (" + dto.getMontoPagado() + ") excede el balance pendiente (" + balance + ")");
        }

        PagoProveedor pago = new PagoProveedor();
        pago.setOrdenCompra(orden);
        pago.setMontoPagado(dto.getMontoPagado());
        pago.setMetodo(dto.getMetodo());
        pago.setNumeroReferencia(dto.getNumeroReferencia());

        return ordenCompraMapper.toPagoDto(pagoProveedorRepository.save(pago));
    }
}
