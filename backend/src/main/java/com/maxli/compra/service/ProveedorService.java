package com.maxli.compra.service;

import com.maxli.compra.dto.ProveedorRequestDTO;
import com.maxli.compra.dto.ProveedorResponseDTO;
import com.maxli.compra.entity.Proveedor;
import com.maxli.compra.mapper.ProveedorMapper;
import com.maxli.compra.repository.ProveedorRepository;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class ProveedorService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final ProveedorRepository proveedorRepository;
    private final ProveedorMapper proveedorMapper;

    @Transactional(readOnly = true)
    public Page<ProveedorResponseDTO> listar(Pageable pageable) {
        return proveedorRepository.findAll(pageable)
                .map(p -> proveedorMapper.toDto(p, calcularBalance(p.getIdProveedor())));
    }

    @Transactional(readOnly = true)
    public Page<ProveedorResponseDTO> listarActivos(Pageable pageable) {
        return proveedorRepository.findByEstado(ACTIVO, pageable)
                .map(p -> proveedorMapper.toDto(p, calcularBalance(p.getIdProveedor())));
    }

    @Transactional(readOnly = true)
    public ProveedorResponseDTO buscarPorId(Long id) {
        Proveedor proveedor = obtenerPorId(id);
        return proveedorMapper.toDto(proveedor, calcularBalance(id));
    }

    @Transactional
    public ProveedorResponseDTO crear(ProveedorRequestDTO dto) {
        if (proveedorRepository.existsByRnc(dto.getRnc())) {
            throw new DuplicateResourceException("Ya existe un proveedor con el RNC: " + dto.getRnc());
        }
        Proveedor proveedor = proveedorMapper.toEntity(dto);
        Proveedor guardado = proveedorRepository.save(proveedor);
        return proveedorMapper.toDto(guardado, BigDecimal.ZERO);
    }

    @Transactional
    public ProveedorResponseDTO actualizar(Long id, ProveedorRequestDTO dto) {
        Proveedor proveedor = obtenerPorId(id);

        if (proveedorRepository.existsByRncAndIdProveedorNot(dto.getRnc(), id)) {
            throw new DuplicateResourceException("Ya existe otro proveedor con el RNC: " + dto.getRnc());
        }

        proveedor.setNombreEmpresa(dto.getNombreEmpresa());
        proveedor.setRnc(dto.getRnc());
        proveedor.setUbicacion(dto.getUbicacion());
        proveedor.setVendedor(dto.getVendedor());
        proveedor.setTelefono(dto.getTelefono());
        proveedor.setEmail(dto.getEmail());
        if (dto.getEstado() != null) {
            proveedor.setEstado(dto.getEstado());
        }

        return proveedorMapper.toDto(proveedorRepository.save(proveedor), calcularBalance(id));
    }

    @Transactional
    public void desactivar(Long id) {
        Proveedor proveedor = obtenerPorId(id);
        proveedor.setEstado(INACTIVO);
        proveedorRepository.save(proveedor);
    }

    // ── Métodos internos ────────────────────────────────────────────────

    public Proveedor obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    private Proveedor obtenerPorId(Long id) {
        return proveedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con id: " + id));
    }

    private BigDecimal calcularBalance(Long idProveedor) {
        BigDecimal totalOrdenes = proveedorRepository.sumTotalOrdenesActivas(idProveedor);
        BigDecimal totalPagado  = proveedorRepository.sumPagosRealizados(idProveedor);
        BigDecimal balance = totalOrdenes.subtract(totalPagado);
        return balance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : balance;
    }
}
