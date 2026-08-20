package com.maxli.gasto.service;

import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.gasto.dto.GastoRequestDTO;
import com.maxli.gasto.dto.GastoResponseDTO;
import com.maxli.gasto.dto.OrdenCompraDisponibleDTO;
import com.maxli.gasto.entity.Gasto;
import com.maxli.gasto.mapper.GastoMapper;
import com.maxli.gasto.repository.GastoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GastoService {

    private static final String PENDIENTE = "PENDIENTE";
    private static final String REALIZADO = "REALIZADO";
    private static final String COMPLETADA = "COMPLETADA";

    private final GastoRepository gastoRepository;
    private final OrdenCompraRepository ordenCompraRepository;
    private final GastoMapper gastoMapper;

    @Transactional(readOnly = true)
    public Page<GastoResponseDTO> listar(Pageable pageable) {
        return gastoRepository.findAll(pageable).map(gastoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public List<OrdenCompraDisponibleDTO> listarOrdenesDisponibles() {
        return ordenCompraRepository.findByEstado(COMPLETADA).stream()
                .filter(orden -> !gastoRepository.existsByOrdenCompra_IdOrdenCompra(orden.getIdOrdenCompra()))
                .map(orden -> new OrdenCompraDisponibleDTO(
                        orden.getIdOrdenCompra(),
                        orden.getProveedor().getNombreEmpresa(),
                        orden.getTotalAPagar()))
                .toList();
    }

    @Transactional
    public GastoResponseDTO crear(GastoRequestDTO dto) {
        OrdenCompra orden = ordenCompraRepository.findById(dto.getIdOrdenCompra())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Orden de compra no encontrada con id: " + dto.getIdOrdenCompra()));

        if (!COMPLETADA.equals(orden.getEstado())) {
            throw new BusinessException("Solo se puede registrar un gasto para una orden completamente recepcionada.");
        }
        if (gastoRepository.existsByOrdenCompra_IdOrdenCompra(orden.getIdOrdenCompra())) {
            throw new BusinessException("La orden de compra ya tiene un gasto registrado.");
        }

        Gasto gasto = new Gasto();
        gasto.setOrdenCompra(orden);
        // Lo recibido, no lo pactado: una orden cerrada con faltantes factura menos.
        gasto.setMonto(orden.getTotalAPagar());
        gasto.setEstado(PENDIENTE);
        return gastoMapper.toDto(gastoRepository.save(gasto));
    }

    @Transactional
    public GastoResponseDTO marcarComoRealizado(Long idGasto) {
        Gasto gasto = gastoRepository.findById(idGasto)
                .orElseThrow(() -> new ResourceNotFoundException("Gasto no encontrado con id: " + idGasto));

        if (REALIZADO.equals(gasto.getEstado())) {
            throw new BusinessException("El gasto ya está marcado como realizado.");
        }

        gasto.setEstado(REALIZADO);
        gasto.setFechaRealizado(LocalDateTime.now());
        return gastoMapper.toDto(gastoRepository.save(gasto));
    }
}
