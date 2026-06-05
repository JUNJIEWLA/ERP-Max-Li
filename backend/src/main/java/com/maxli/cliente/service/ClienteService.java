package com.maxli.cliente.service;

import com.maxli.cliente.dto.ClienteRequestDTO;
import com.maxli.cliente.dto.ClienteResumenDTO;
import com.maxli.cliente.dto.ClienteResponseDTO;
import com.maxli.cliente.entity.Cliente;
import com.maxli.cliente.mapper.ClienteMapper;
import com.maxli.cliente.repository.ClienteRepository;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClienteService {

    private static final String ACTIVO   = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    /** ID reservado para "Consumidor Final" (pre-insertado en V14). */
    public static final Long ID_CONSUMIDOR_FINAL = 1L;

    private final ClienteRepository clienteRepository;
    private final ClienteMapper      clienteMapper;

    // ── Consultas ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ClienteResponseDTO> listar(Pageable pageable) {
        return clienteRepository.findAll(pageable)
                .map(clienteMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ClienteResponseDTO> listarActivos(Pageable pageable) {
        return clienteRepository.findByEstado(ACTIVO, pageable)
                .map(clienteMapper::toDto);
    }

    @Transactional(readOnly = true)
    public ClienteResponseDTO buscarPorId(Long id) {
        return clienteMapper.toDto(obtenerPorId(id));
    }

    /**
     * Búsqueda rápida para el selector del POS.
     * Busca en nombre_completo (case-insensitive). Retorna máximo 20 resultados activos.
     * Excluye siempre al "Consumidor Final" genérico (id=1), que se gestiona aparte.
     */
    @Transactional(readOnly = true)
    public List<ClienteResumenDTO> buscarParaPOS(String query) {
        return clienteRepository
                .findTop20ByNombreCompletoContainingIgnoreCaseAndEstadoOrderByNombreCompletoAsc(query, ACTIVO)
                .stream()
                .filter(c -> !c.getIdCliente().equals(ID_CONSUMIDOR_FINAL))
                .map(clienteMapper::toResumenDto)
                .toList();
    }

    // ── Mutaciones ───────────────────────────────────────────────────────

    @Transactional
    public ClienteResponseDTO crear(ClienteRequestDTO dto) {
        // Regla DGII: B01 requiere RNC/Cédula
        validarRncParaB01(dto.getTipoNcfPreferido(), dto.getRncCedula(), null);

        // Unicidad de RNC/Cédula (solo cuando se proporciona)
        if (dto.getRncCedula() != null && !dto.getRncCedula().isBlank()) {
            if (clienteRepository.existsByRncCedula(dto.getRncCedula().trim())) {
                throw new DuplicateResourceException(
                        "Ya existe un cliente con el RNC/Cédula: " + dto.getRncCedula());
            }
        }

        Cliente cliente = clienteMapper.toEntity(dto);
        return clienteMapper.toDto(clienteRepository.save(cliente));
    }

    @Transactional
    public ClienteResponseDTO actualizar(Long id, ClienteRequestDTO dto) {
        Cliente cliente = obtenerPorId(id);

        // No permitir editar el registro "Consumidor Final" genérico
        if (cliente.getIdCliente().equals(ID_CONSUMIDOR_FINAL)) {
            throw new IllegalArgumentException(
                    "El cliente 'Consumidor Final' genérico no puede modificarse.");
        }

        // Regla DGII: B01 requiere RNC/Cédula
        validarRncParaB01(dto.getTipoNcfPreferido(), dto.getRncCedula(), id);

        // Unicidad de RNC/Cédula excluyendo el propio registro
        if (dto.getRncCedula() != null && !dto.getRncCedula().isBlank()) {
            if (clienteRepository.existsByRncCedulaAndIdClienteNot(dto.getRncCedula().trim(), id)) {
                throw new DuplicateResourceException(
                        "Ya existe otro cliente con el RNC/Cédula: " + dto.getRncCedula());
            }
        }

        cliente.setNombreCompleto(dto.getNombreCompleto().trim());
        cliente.setRncCedula(dto.getRncCedula() != null ? dto.getRncCedula().trim() : null);
        cliente.setTelefono(dto.getTelefono());
        cliente.setEmail(dto.getEmail());
        cliente.setDireccion(dto.getDireccion());
        cliente.setTipoNcfPreferido(dto.getTipoNcfPreferido() != null ? dto.getTipoNcfPreferido() : "B02");
        if (dto.getDescuentoPredeterminado() != null) {
            cliente.setDescuentoPredeterminado(dto.getDescuentoPredeterminado());
        }
        if (dto.getEstado() != null) {
            cliente.setEstado(dto.getEstado());
        }

        return clienteMapper.toDto(clienteRepository.save(cliente));
    }

    @Transactional
    public void desactivar(Long id) {
        Cliente cliente = obtenerPorId(id);
        if (cliente.getIdCliente().equals(ID_CONSUMIDOR_FINAL)) {
            throw new IllegalArgumentException(
                    "El cliente 'Consumidor Final' genérico no puede desactivarse.");
        }
        cliente.setEstado(INACTIVO);
        clienteRepository.save(cliente);
    }

    /**
     * Acumula el monto de una venta al historial del cliente.
     * Llamar desde VentaService dentro de la misma transacción de venta.
     */
    @Transactional
    public void acumularCompra(Long idCliente, BigDecimal monto) {
        Cliente cliente = obtenerPorId(idCliente);
        cliente.setTotalCompras(cliente.getTotalCompras().add(monto));
        clienteRepository.save(cliente);
    }

    // ── Acceso interno (para VentaService u otros módulos) ───────────────

    public Cliente obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    // ── Helpers privados ─────────────────────────────────────────────────

    private Cliente obtenerPorId(Long id) {
        return clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente no encontrado con id: " + id));
    }

    /**
     * Regla DGII: el comprobante Crédito Fiscal (B01) exige RNC/Cédula del cliente.
     */
    private void validarRncParaB01(String tipoNcf, String rncCedula, Long idCliente) {
        if ("B01".equals(tipoNcf) && (rncCedula == null || rncCedula.isBlank())) {
            throw new IllegalArgumentException(
                    "El RNC/Cédula es obligatorio cuando el comprobante preferido es Crédito Fiscal (B01).");
        }
    }
}
