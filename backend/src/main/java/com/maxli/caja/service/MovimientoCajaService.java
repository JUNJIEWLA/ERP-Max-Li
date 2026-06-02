package com.maxli.caja.service;

import com.maxli.caja.dto.MovimientoCajaRequestDTO;
import com.maxli.caja.dto.MovimientoCajaResponseDTO;
import com.maxli.caja.entity.CajaChica;
import com.maxli.caja.entity.MovimientoCaja;
import com.maxli.caja.mapper.MovimientoCajaMapper;
import com.maxli.caja.repository.CajaChicaRepository;
import com.maxli.caja.repository.MovimientoCajaRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MovimientoCajaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INGRESO = "INGRESO";
    private static final String EGRESO = "EGRESO";
    private static final BigDecimal CERO = new BigDecimal("0.00");
    private static final Set<String> TIPOS_PERMITIDOS = Set.of(INGRESO, EGRESO);

    private final MovimientoCajaRepository movimientoCajaRepository;
    private final CajaChicaRepository cajaChicaRepository;
    private final UsuarioRepository usuarioRepository;
    private final MovimientoCajaMapper movimientoCajaMapper;

    @Transactional(readOnly = true)
    public Page<MovimientoCajaResponseDTO> listarPorCajaChica(Long idCajaChica, Pageable pageable) {
        if (!cajaChicaRepository.existsById(idCajaChica)) {
            throw new ResourceNotFoundException("Caja chica no encontrada con id: " + idCajaChica);
        }
        return movimientoCajaRepository
                .findByCajaChica_IdCajaChicaOrderByFechaHoraDesc(idCajaChica, pageable)
                .map(movimientoCajaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public MovimientoCajaResponseDTO buscarPorId(Long idMovimiento) {
        MovimientoCaja movimiento = movimientoCajaRepository.findByIdMovimiento(idMovimiento)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Movimiento de caja no encontrado con id: " + idMovimiento));
        return movimientoCajaMapper.toDto(movimiento);
    }

    @Transactional
    public MovimientoCajaResponseDTO registrar(Long idCajaChica, MovimientoCajaRequestDTO dto, String username) {
        CajaChica cajaChica = obtenerCajaChicaActivaParaActualizar(idCajaChica);
        Usuario usuario = obtenerUsuarioActivo(username);
        String tipoMovimiento = normalizarTipo(dto.getTipoMovimiento());
        BigDecimal monto = normalizarMonto(dto.getMonto());
        String concepto = normalizarConcepto(dto.getConcepto());

        BigDecimal nuevoSaldo = calcularNuevoSaldo(cajaChica, tipoMovimiento, monto);
        cajaChica.setSaldoActual(nuevoSaldo);
        cajaChicaRepository.save(cajaChica);

        MovimientoCaja movimiento = new MovimientoCaja();
        movimiento.setCajaChica(cajaChica);
        movimiento.setUsuario(usuario);
        movimiento.setTipoMovimiento(tipoMovimiento);
        movimiento.setFechaHora(LocalDateTime.now());
        movimiento.setMonto(monto);
        movimiento.setConcepto(concepto);

        return movimientoCajaMapper.toDto(movimientoCajaRepository.save(movimiento));
    }

    private CajaChica obtenerCajaChicaActivaParaActualizar(Long idCajaChica) {
        return cajaChicaRepository.findByIdForUpdate(idCajaChica)
                .filter(cajaChica -> ACTIVO.equals(cajaChica.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Caja chica no encontrada o inactiva con id: " + idCajaChica));
    }

    private Usuario obtenerUsuarioActivo(String username) {
        return usuarioRepository.findByUsername(username)
                .filter(usuario -> ACTIVO.equals(usuario.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado o inactivo: " + username));
    }

    private String normalizarTipo(String tipoMovimiento) {
        if (tipoMovimiento == null) {
            throw new BusinessException("El tipo de movimiento es obligatorio");
        }
        String tipo = tipoMovimiento.trim().toUpperCase(Locale.ROOT);
        if (!TIPOS_PERMITIDOS.contains(tipo)) {
            throw new BusinessException("El tipo de movimiento debe ser INGRESO o EGRESO");
        }
        return tipo;
    }

    private BigDecimal normalizarMonto(BigDecimal monto) {
        if (monto == null || monto.compareTo(CERO) <= 0) {
            throw new BusinessException("El monto debe ser mayor a cero");
        }
        return normalizarDecimal(monto);
    }

    private String normalizarConcepto(String concepto) {
        if (concepto == null || concepto.trim().isEmpty()) {
            throw new BusinessException("El concepto es obligatorio");
        }
        return concepto.trim();
    }

    private BigDecimal calcularNuevoSaldo(CajaChica cajaChica, String tipoMovimiento, BigDecimal monto) {
        BigDecimal saldoActual = valor(cajaChica.getSaldoActual());
        BigDecimal nuevoSaldo = INGRESO.equals(tipoMovimiento)
                ? saldoActual.add(monto)
                : saldoActual.subtract(monto);

        if (EGRESO.equals(tipoMovimiento) && nuevoSaldo.compareTo(CERO) < 0) {
            throw new BusinessException("La caja chica no tiene saldo suficiente para registrar el egreso");
        }

        if (INGRESO.equals(tipoMovimiento) && nuevoSaldo.compareTo(cajaChica.getLimiteMonto()) > 0) {
            throw new BusinessException("El ingreso supera el limite de la caja chica");
        }

        return normalizarDecimal(nuevoSaldo);
    }

    private BigDecimal valor(BigDecimal valor) {
        return valor == null ? CERO : normalizarDecimal(valor);
    }

    private BigDecimal normalizarDecimal(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }
}
