package com.maxli.caja.service;

import com.maxli.caja.dto.AbrirTurnoCajaRequestDTO;
import com.maxli.caja.dto.CerrarTurnoCajaRequestDTO;
import com.maxli.caja.dto.TurnoCajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.mapper.TurnoCajaMapper;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
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
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TurnoCajaServiceTest {

    @Mock private TurnoCajaRepository turnoCajaRepository;
    @Mock private CajaRepository cajaRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private TurnoCajaMapper turnoCajaMapper;
    @InjectMocks private TurnoCajaService turnoCajaService;

    @Test
    void abrir_crea_turno_abierto_con_usuario_autenticado() {
        AbrirTurnoCajaRequestDTO request = abrirRequest();
        Caja caja = cajaActiva();
        Usuario usuario = usuarioActivo("cajero");
        TurnoCajaResponseDTO expectedDto = response(10L, "ABIERTO");

        when(cajaRepository.findById(1L)).thenReturn(Optional.of(caja));
        when(usuarioRepository.findByUsername("cajero")).thenReturn(Optional.of(usuario));
        when(turnoCajaRepository.existsByCaja_IdCajaAndEstado(1L, "ABIERTO")).thenReturn(false);
        when(turnoCajaRepository.existsByUsuarioApertura_UsernameAndEstado("cajero", "ABIERTO")).thenReturn(false);
        when(turnoCajaRepository.save(any(TurnoCaja.class))).thenAnswer(invocation -> {
            TurnoCaja turno = invocation.getArgument(0);
            turno.setIdTurnoCaja(10L);
            return turno;
        });
        when(turnoCajaMapper.toDto(any(TurnoCaja.class))).thenReturn(expectedDto);

        TurnoCajaResponseDTO result = turnoCajaService.abrir(request, "cajero");

        assertThat(result.getIdTurnoCaja()).isEqualTo(10L);
        assertThat(result.getEstado()).isEqualTo("ABIERTO");

        ArgumentCaptor<TurnoCaja> captor = ArgumentCaptor.forClass(TurnoCaja.class);
        verify(turnoCajaRepository).save(captor.capture());
        TurnoCaja turnoGuardado = captor.getValue();
        assertThat(turnoGuardado.getCaja()).isSameAs(caja);
        assertThat(turnoGuardado.getUsuarioApertura()).isSameAs(usuario);
        assertThat(turnoGuardado.getMontoInicial()).isEqualByComparingTo("5000.00");
        assertThat(turnoGuardado.getEstado()).isEqualTo("ABIERTO");
        assertThat(turnoGuardado.getFechaApertura()).isNotNull();
    }

    @Test
    void abrir_lanza_excepcion_si_caja_esta_inactiva() {
        Caja caja = cajaActiva();
        caja.setEstado("INACTIVO");

        when(cajaRepository.findById(1L)).thenReturn(Optional.of(caja));

        assertThatThrownBy(() -> turnoCajaService.abrir(abrirRequest(), "cajero"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("1");

        verifyNoInteractions(usuarioRepository, turnoCajaRepository, turnoCajaMapper);
    }

    @Test
    void abrir_lanza_excepcion_si_caja_ya_tiene_turno_abierto() {
        when(cajaRepository.findById(1L)).thenReturn(Optional.of(cajaActiva()));
        when(usuarioRepository.findByUsername("cajero")).thenReturn(Optional.of(usuarioActivo("cajero")));
        when(turnoCajaRepository.existsByCaja_IdCajaAndEstado(1L, "ABIERTO")).thenReturn(true);

        assertThatThrownBy(() -> turnoCajaService.abrir(abrirRequest(), "cajero"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("ya tiene un turno abierto");

        verifyNoInteractions(turnoCajaMapper);
    }

    @Test
    void abrir_lanza_excepcion_si_usuario_ya_tiene_turno_abierto() {
        when(cajaRepository.findById(1L)).thenReturn(Optional.of(cajaActiva()));
        when(usuarioRepository.findByUsername("cajero")).thenReturn(Optional.of(usuarioActivo("cajero")));
        when(turnoCajaRepository.existsByCaja_IdCajaAndEstado(1L, "ABIERTO")).thenReturn(false);
        when(turnoCajaRepository.existsByUsuarioApertura_UsernameAndEstado("cajero", "ABIERTO")).thenReturn(true);

        assertThatThrownBy(() -> turnoCajaService.abrir(abrirRequest(), "cajero"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("cajero");

        verifyNoInteractions(turnoCajaMapper);
    }

    @Test
    void cerrar_cambia_estado_y_registra_usuario_de_cierre() {
        TurnoCaja turno = turnoAbierto();
        CerrarTurnoCajaRequestDTO request = cerrarRequest();
        Usuario supervisor = usuarioActivo("supervisor");

        when(turnoCajaRepository.findById(10L)).thenReturn(Optional.of(turno));
        when(usuarioRepository.findByUsername("supervisor")).thenReturn(Optional.of(supervisor));
        when(turnoCajaRepository.save(turno)).thenReturn(turno);
        when(turnoCajaMapper.toDto(turno)).thenReturn(response(10L, "CERRADO"));

        TurnoCajaResponseDTO result = turnoCajaService.cerrar(10L, request, "supervisor");

        assertThat(result.getEstado()).isEqualTo("CERRADO");
        assertThat(turno.getEstado()).isEqualTo("CERRADO");
        assertThat(turno.getUsuarioCierre()).isSameAs(supervisor);
        assertThat(turno.getMontoFinalDeclarado()).isEqualByComparingTo("7600.00");
        assertThat(turno.getFechaCierre()).isNotNull();
        verify(turnoCajaRepository).save(turno);
    }

    @Test
    void cerrar_lanza_excepcion_si_turno_no_esta_abierto() {
        TurnoCaja turno = turnoAbierto();
        turno.setEstado("CERRADO");

        when(turnoCajaRepository.findById(10L)).thenReturn(Optional.of(turno));

        assertThatThrownBy(() -> turnoCajaService.cerrar(10L, cerrarRequest(), "supervisor"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("CERRADO");

        verifyNoInteractions(usuarioRepository, turnoCajaMapper);
    }

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(turnoCajaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> turnoCajaService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    private AbrirTurnoCajaRequestDTO abrirRequest() {
        AbrirTurnoCajaRequestDTO request = new AbrirTurnoCajaRequestDTO();
        request.setIdCaja(1L);
        request.setMontoInicial(new BigDecimal("5000.00"));
        request.setObservacionApertura("Inicio de turno");
        return request;
    }

    private CerrarTurnoCajaRequestDTO cerrarRequest() {
        CerrarTurnoCajaRequestDTO request = new CerrarTurnoCajaRequestDTO();
        request.setMontoFinalDeclarado(new BigDecimal("7600.00"));
        request.setObservacionCierre("Cierre normal");
        return request;
    }

    private Caja cajaActiva() {
        Caja caja = new Caja();
        caja.setIdCaja(1L);
        caja.setNombre("Caja Principal");
        caja.setEstado("ACTIVO");
        return caja;
    }

    private Usuario usuarioActivo(String username) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario("supervisor".equals(username) ? 2L : 1L);
        usuario.setUsername(username);
        usuario.setEmail(username + "@maxli.com");
        usuario.setEstado("ACTIVO");
        return usuario;
    }

    private TurnoCaja turnoAbierto() {
        TurnoCaja turno = new TurnoCaja();
        turno.setIdTurnoCaja(10L);
        turno.setCaja(cajaActiva());
        turno.setUsuarioApertura(usuarioActivo("cajero"));
        turno.setMontoInicial(new BigDecimal("5000.00"));
        turno.setEstado("ABIERTO");
        turno.setFechaApertura(LocalDateTime.now().minusHours(4));
        return turno;
    }

    private TurnoCajaResponseDTO response(Long id, String estado) {
        TurnoCajaResponseDTO response = new TurnoCajaResponseDTO();
        response.setIdTurnoCaja(id);
        response.setEstado(estado);
        return response;
    }
}
