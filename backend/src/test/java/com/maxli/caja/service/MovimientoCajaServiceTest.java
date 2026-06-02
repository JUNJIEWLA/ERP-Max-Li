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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovimientoCajaServiceTest {

    @Mock private MovimientoCajaRepository movimientoCajaRepository;
    @Mock private CajaChicaRepository cajaChicaRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private MovimientoCajaMapper movimientoCajaMapper;
    @InjectMocks private MovimientoCajaService movimientoCajaService;

    @Test
    void registrar_ingreso_actualiza_saldo_y_guarda_movimiento() {
        CajaChica cajaChica = cajaChica();
        Usuario usuario = usuarioActivo();
        MovimientoCajaResponseDTO expectedDto = response(1L, "INGRESO");

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica));
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(usuario));
        when(cajaChicaRepository.save(cajaChica)).thenReturn(cajaChica);
        when(movimientoCajaRepository.save(any(MovimientoCaja.class))).thenAnswer(invocation -> {
            MovimientoCaja movimiento = invocation.getArgument(0);
            movimiento.setIdMovimiento(1L);
            return movimiento;
        });
        when(movimientoCajaMapper.toDto(any(MovimientoCaja.class))).thenReturn(expectedDto);

        MovimientoCajaResponseDTO result = movimientoCajaService.registrar(1L, ingresoRequest(), "admin");

        assertThat(result.getIdMovimiento()).isEqualTo(1L);
        assertThat(result.getTipoMovimiento()).isEqualTo("INGRESO");
        assertThat(cajaChica.getSaldoActual()).isEqualByComparingTo("9000.00");
        verify(cajaChicaRepository).save(cajaChica);

        ArgumentCaptor<MovimientoCaja> captor = ArgumentCaptor.forClass(MovimientoCaja.class);
        verify(movimientoCajaRepository).save(captor.capture());
        MovimientoCaja movimientoGuardado = captor.getValue();
        assertThat(movimientoGuardado.getCajaChica()).isSameAs(cajaChica);
        assertThat(movimientoGuardado.getUsuario()).isSameAs(usuario);
        assertThat(movimientoGuardado.getMonto()).isEqualByComparingTo("500.00");
        assertThat(movimientoGuardado.getConcepto()).isEqualTo("Reposicion de fondo");
        assertThat(movimientoGuardado.getFechaHora()).isNotNull();
    }

    @Test
    void registrar_egreso_actualiza_saldo_y_guarda_movimiento() {
        CajaChica cajaChica = cajaChica();

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica));
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(usuarioActivo()));
        when(cajaChicaRepository.save(cajaChica)).thenReturn(cajaChica);
        when(movimientoCajaRepository.save(any(MovimientoCaja.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(movimientoCajaMapper.toDto(any(MovimientoCaja.class))).thenReturn(response(2L, "EGRESO"));

        MovimientoCajaResponseDTO result = movimientoCajaService.registrar(1L, egresoRequest(), "admin");

        assertThat(result.getTipoMovimiento()).isEqualTo("EGRESO");
        assertThat(cajaChica.getSaldoActual()).isEqualByComparingTo("8200.00");
    }

    @Test
    void registrar_egreso_permite_dejar_saldo_en_cero() {
        CajaChica cajaChica = cajaChica();
        MovimientoCajaRequestDTO request = egresoRequest();
        request.setMonto(new BigDecimal("8500.00"));

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica));
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(usuarioActivo()));
        when(cajaChicaRepository.save(cajaChica)).thenReturn(cajaChica);
        when(movimientoCajaRepository.save(any(MovimientoCaja.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(movimientoCajaMapper.toDto(any(MovimientoCaja.class))).thenReturn(response(3L, "EGRESO"));

        movimientoCajaService.registrar(1L, request, "admin");

        assertThat(cajaChica.getSaldoActual()).isEqualByComparingTo("0.00");
    }

    @Test
    void registrar_egreso_lanza_excepcion_si_saldo_es_insuficiente() {
        CajaChica cajaChica = cajaChica();
        MovimientoCajaRequestDTO request = egresoRequest();
        request.setMonto(new BigDecimal("9000.00"));

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica));
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(usuarioActivo()));

        assertThatThrownBy(() -> movimientoCajaService.registrar(1L, request, "admin"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("saldo suficiente");

        verifyNoInteractions(movimientoCajaRepository, movimientoCajaMapper);
    }

    @Test
    void registrar_ingreso_lanza_excepcion_si_supera_limite() {
        MovimientoCajaRequestDTO request = ingresoRequest();
        request.setMonto(new BigDecimal("2000.00"));

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica()));
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(usuarioActivo()));

        assertThatThrownBy(() -> movimientoCajaService.registrar(1L, request, "admin"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("limite");

        verifyNoInteractions(movimientoCajaRepository, movimientoCajaMapper);
    }

    @Test
    void registrar_lanza_excepcion_si_caja_chica_esta_inactiva() {
        CajaChica cajaChica = cajaChica();
        cajaChica.setEstado("INACTIVO");

        when(cajaChicaRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(cajaChica));

        assertThatThrownBy(() -> movimientoCajaService.registrar(1L, ingresoRequest(), "admin"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("1");

        verifyNoInteractions(usuarioRepository, movimientoCajaRepository, movimientoCajaMapper);
    }

    private MovimientoCajaRequestDTO ingresoRequest() {
        MovimientoCajaRequestDTO request = new MovimientoCajaRequestDTO();
        request.setTipoMovimiento("INGRESO");
        request.setMonto(new BigDecimal("500.00"));
        request.setConcepto("Reposicion de fondo");
        return request;
    }

    private MovimientoCajaRequestDTO egresoRequest() {
        MovimientoCajaRequestDTO request = new MovimientoCajaRequestDTO();
        request.setTipoMovimiento("EGRESO");
        request.setMonto(new BigDecimal("300.00"));
        request.setConcepto("Compra de utiles");
        return request;
    }

    private CajaChica cajaChica() {
        CajaChica cajaChica = new CajaChica();
        cajaChica.setIdCajaChica(1L);
        cajaChica.setNombre("Caja Chica Admin");
        cajaChica.setResponsable("Admin");
        cajaChica.setSaldoActual(new BigDecimal("8500.00"));
        cajaChica.setLimiteMonto(new BigDecimal("10000.00"));
        cajaChica.setEstado("ACTIVO");
        return cajaChica;
    }

    private Usuario usuarioActivo() {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(1L);
        usuario.setUsername("admin");
        usuario.setEmail("admin@maxli.com");
        usuario.setEstado("ACTIVO");
        return usuario;
    }

    private MovimientoCajaResponseDTO response(Long id, String tipoMovimiento) {
        MovimientoCajaResponseDTO response = new MovimientoCajaResponseDTO();
        response.setIdMovimiento(id);
        response.setTipoMovimiento(tipoMovimiento);
        return response;
    }
}
