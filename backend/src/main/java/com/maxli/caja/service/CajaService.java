package com.maxli.caja.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.dto.CajaRequestDTO;
import com.maxli.caja.dto.CajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.mapper.CajaMapper;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CajaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";
    private static final String ABIERTO = "ABIERTO";

    private final CajaRepository cajaRepository;
    private final CajaMapper cajaMapper;
    private final AlmacenRepository almacenRepository;
    private final TurnoCajaRepository turnoCajaRepository;

    @Transactional(readOnly = true)
    public Page<CajaResponseDTO> listar(Pageable pageable) {
        return cajaRepository.findAll(pageable).map(cajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<CajaResponseDTO> listarActivas(Pageable pageable) {
        return cajaRepository.findByEstado(ACTIVO, pageable).map(cajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public CajaResponseDTO buscarPorId(Long id) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        return cajaMapper.toDto(caja);
    }

    @Transactional
    public CajaResponseDTO crear(CajaRequestDTO dto) {
        dto.setNombre(dto.getNombre().trim());
        validarNombreActivoDisponible(dto.getNombre(), dto.getEstado(), null);
        Caja caja = cajaMapper.toEntity(dto);
        caja.setAlmacen(resolverAlmacen(dto.getIdAlmacen()));
        return cajaMapper.toDto(cajaRepository.save(caja));
    }

    @Transactional
    public CajaResponseDTO actualizar(Long id, CajaRequestDTO dto) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        dto.setNombre(dto.getNombre().trim());
        validarNombreActivoDisponible(dto.getNombre(), dto.getEstado(), id);
        caja.setNombre(dto.getNombre());
        if (dto.getEstado() != null) {
            caja.setEstado(dto.getEstado());
        }
        validarCambioAlmacenPermitido(caja, dto.getIdAlmacen());
        caja.setAlmacen(resolverAlmacen(dto.getIdAlmacen()));
        return cajaMapper.toDto(cajaRepository.save(caja));
    }

    /**
     * Un turno hereda el almacén de su caja en el momento de cada venta
     * ({@link com.maxli.venta.service.VentaService#procesarVenta}), no una
     * sola vez al abrirse. Si se reasigna el almacén de la caja mientras el
     * turno sigue {@code ABIERTO}, dos ventas del mismo turno podrían acabar
     * descontando existencia de almacenes distintos. Reasignar solo es seguro
     * con la caja sin turno abierto, o si nunca tuvo almacén (no pudo haberse
     * vendido nada en ese turno todavía: {@code procesarVenta} lo bloquea).
     */
    private void validarCambioAlmacenPermitido(Caja caja, Long idAlmacenNuevo) {
        Almacen almacenActual = caja.getAlmacen();
        boolean cambiaAlmacen = almacenActual != null && !almacenActual.getIdAlmacen().equals(idAlmacenNuevo);
        if (cambiaAlmacen && turnoCajaRepository.existsByCaja_IdCajaAndEstado(caja.getIdCaja(), ABIERTO)) {
            throw new BusinessException(
                    "No se puede cambiar el almacén de la caja mientras tiene un turno ABIERTO. "
                            + "Cierre el turno antes de reasignarla.");
        }
    }

    private Almacen resolverAlmacen(Long idAlmacen) {
        Almacen almacen = almacenRepository.findById(idAlmacen)
                .orElseThrow(() -> new ResourceNotFoundException("Almacén no encontrado con id: " + idAlmacen));
        if (!ACTIVO.equals(almacen.getEstado())) {
            throw new BusinessException("El almacén '" + almacen.getNombre() + "' no está activo.");
        }
        return almacen;
    }

    @Transactional
    public void desactivar(Long id) {
        Caja caja = cajaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caja no encontrada con id: " + id));
        caja.setEstado(INACTIVO);
        cajaRepository.save(caja);
    }

    private void validarNombreActivoDisponible(String nombre, String estado, Long idCajaActual) {
        String estadoObjetivo = estado != null ? estado : ACTIVO;
        if (!ACTIVO.equals(estadoObjetivo)) {
            return;
        }

        boolean duplicada = idCajaActual == null
                ? cajaRepository.existsByNombreAndEstado(nombre, ACTIVO)
                : cajaRepository.existsByNombreAndEstadoAndIdCajaNot(nombre, ACTIVO, idCajaActual);

        if (duplicada) {
            throw new DuplicateResourceException("Ya existe una caja activa con nombre: " + nombre);
        }
    }
}
