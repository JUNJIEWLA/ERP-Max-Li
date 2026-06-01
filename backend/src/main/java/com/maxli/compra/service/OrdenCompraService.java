package com.maxli.compra.service;

import com.maxli.compra.dto.DetalleOrdenCompraRequestDTO;
import com.maxli.compra.dto.OrdenCompraRequestDTO;
import com.maxli.compra.dto.OrdenCompraResponseDTO;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.entity.Proveedor;
import com.maxli.compra.mapper.OrdenCompraMapper;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OrdenCompraService {

    // Estados de la orden
    private static final String BORRADOR           = "BORRADOR";
    private static final String ENVIADA            = "ENVIADA";
    private static final String RECEPCION_PARCIAL  = "RECEPCION_PARCIAL";
    private static final String COMPLETADA         = "COMPLETADA";
    private static final String ANULADA            = "ANULADA";

    private final OrdenCompraRepository ordenCompraRepository;
    private final ProductoRepository productoRepository;
    private final ProveedorService proveedorService;
    private final OrdenCompraMapper ordenCompraMapper;

    @Transactional(readOnly = true)
    public Page<OrdenCompraResponseDTO> listar(Pageable pageable) {
        return ordenCompraRepository.findAll(pageable).map(ordenCompraMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OrdenCompraResponseDTO> listarPorProveedor(Long idProveedor, Pageable pageable) {
        return ordenCompraRepository.findByProveedor_IdProveedor(idProveedor, pageable)
                .map(ordenCompraMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OrdenCompraResponseDTO> listarPorEstado(String estado, Pageable pageable) {
        return ordenCompraRepository.findByEstado(estado, pageable).map(ordenCompraMapper::toDto);
    }

    @Transactional(readOnly = true)
    public OrdenCompraResponseDTO buscarPorId(Long id) {
        return ordenCompraMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public OrdenCompraResponseDTO crear(OrdenCompraRequestDTO dto) {
        Proveedor proveedor = proveedorService.obtenerEntidadPorId(dto.getIdProveedor());
        if (!"ACTIVO".equals(proveedor.getEstado())) {
            throw new BusinessException("El proveedor con id " + dto.getIdProveedor() + " está inactivo");
        }

        OrdenCompra orden = new OrdenCompra();
        orden.setProveedor(proveedor);
        orden.setEstado(BORRADOR);

        // Construir detalles y calcular total
        List<DetalleOrdenCompra> detalles = dto.getDetalles().stream()
                .map(d -> construirDetalle(d, orden))
                .toList();

        orden.getDetalles().addAll(detalles);

        BigDecimal total = detalles.stream()
                .map(DetalleOrdenCompra::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        orden.setTotal(total);

        return ordenCompraMapper.toDto(ordenCompraRepository.save(orden));
    }

    @Transactional
    public OrdenCompraResponseDTO enviar(Long id) {
        OrdenCompra orden = obtenerPorId(id);
        validarEstado(orden, Set.of(BORRADOR), "enviar");
        orden.setEstado(ENVIADA);
        return ordenCompraMapper.toDto(ordenCompraRepository.save(orden));
    }

    @Transactional
    public OrdenCompraResponseDTO anular(Long id) {
        OrdenCompra orden = obtenerPorId(id);
        validarEstado(orden, Set.of(BORRADOR, ENVIADA), "anular");
        orden.setEstado(ANULADA);
        return ordenCompraMapper.toDto(ordenCompraRepository.save(orden));
    }

    /**
     * Fuerza el cierre de la orden como COMPLETADA sin requerir la mercancía faltante.
     * Útil cuando el proveedor confirma que el remanente no será entregado.
     */
    @Transactional
    public OrdenCompraResponseDTO forzarCierre(Long id) {
        OrdenCompra orden = obtenerPorId(id);
        validarEstado(orden, Set.of(ENVIADA, RECEPCION_PARCIAL), "forzar cierre");
        orden.setEstado(COMPLETADA);
        return ordenCompraMapper.toDto(ordenCompraRepository.save(orden));
    }

    // ── Métodos internos / para otros servicios ─────────────────────────

    public OrdenCompra obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    // ── Privados ────────────────────────────────────────────────────────

    private OrdenCompra obtenerPorId(Long id) {
        return ordenCompraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Orden de compra no encontrada con id: " + id));
    }

    private DetalleOrdenCompra construirDetalle(DetalleOrdenCompraRequestDTO dto, OrdenCompra orden) {
        Producto producto = productoRepository.findById(dto.getIdProducto())
                .filter(p -> "ACTIVO".equals(p.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado o inactivo con id: " + dto.getIdProducto()));

        DetalleOrdenCompra detalle = new DetalleOrdenCompra();
        detalle.setOrdenCompra(orden);
        detalle.setProducto(producto);
        detalle.setCantidad(dto.getCantidad());
        detalle.setPrecioUnitario(dto.getPrecioUnitario());
        detalle.setSubtotal(dto.getPrecioUnitario().multiply(BigDecimal.valueOf(dto.getCantidad())));
        detalle.setCantidadRecibida(0);
        return detalle;
    }

    private void validarEstado(OrdenCompra orden, Set<String> estadosPermitidos, String accion) {
        if (!estadosPermitidos.contains(orden.getEstado())) {
            throw new BusinessException(
                    "No se puede " + accion + " una orden en estado '" + orden.getEstado() +
                    "'. Estados permitidos: " + estadosPermitidos);
        }
    }
}
