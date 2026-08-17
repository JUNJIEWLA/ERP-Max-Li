package com.maxli.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxli.auth.controller.AuthController;
import com.maxli.auth.dto.LoginRequestDTO;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.config.JsonAuthResponseHandler;
import com.maxli.config.JwtAuthFilter;
import com.maxli.config.JwtUtil;
import com.maxli.config.SecurityConfig;
import com.maxli.config.SessionCookieService;
import com.maxli.config.UserDetailsServiceImpl;
import com.maxli.exception.GlobalExceptionHandler;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ISSUE-010 — El login no tenía límite de intentos: una lista de contraseñas
 * podía probarse entera contra la API.
 *
 * <p>El tiempo avanza con un {@link Clock} controlado, no con {@code Thread.sleep}:
 * comprobar que un bloqueo de 15 minutos vence no puede costar 15 minutos.
 */
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class,
        LoginAttemptService.class, GlobalExceptionHandler.class,
        LoginFuerzaBrutaTest.RelojDePrueba.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-fuerza-bruta-maxli-erp-2026-larga-de-sobra",
        "cors.allowed-origins=https://erp.plazamax.do",
        "maxli.security.login.max-intentos=3",
        "maxli.security.login.ventana=10m",
        "maxli.security.login.bloqueo=15m"
})
@DisplayName("Login — freno de fuerza bruta")
class LoginFuerzaBrutaTest {

    /** Reloj mutable: las pruebas adelantan el tiempo a voluntad. */
    @TestConfiguration
    static class RelojDePrueba {
        static Instant ahora = Instant.parse("2026-08-16T12:00:00Z");

        @Bean
        Clock clock() {
            return new Clock() {
                @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
                @Override public Clock withZone(ZoneId zone) { return this; }
                @Override public Instant instant() { return ahora; }
            };
        }
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;

    /**
     * El servicio de intentos es un singleton compartido por todos los métodos
     * de esta clase. En lugar de exponer un "limpiar" que solo existiría para
     * las pruebas, el reloj avanza un día entre test y test: así toda entrada
     * previa queda fuera de su ventana y cada método parte de cero.
     */
    @BeforeEach
    void adelantarRelojParaAislarCadaPrueba() {
        RelojDePrueba.ahora = RelojDePrueba.ahora.plus(Duration.ofDays(1));
    }

    private void avanzar(Duration cuanto) {
        RelojDePrueba.ahora = RelojDePrueba.ahora.plus(cuanto);
    }

    @Test
    @DisplayName("una contraseña incorrecta devuelve 401 con mensaje genérico")
    void credencialIncorrectaDevuelve401Generico() throws Exception {
        credencialesInvalidas();

        intentar("cajera", "mala").andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("un usuario inexistente responde igual que uno real: no hay enumeración")
    void usuarioInexistenteNoSeDistingue() throws Exception {
        credencialesInvalidas();

        String respuestaUsuarioReal = intentar("cajera", "mala")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String respuestaUsuarioFantasma = intentar("no-existe-jamas", "mala")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(respuestaUsuarioFantasma)
                .as("el cuerpo no debe revelar si la cuenta existe")
                .isEqualTo(respuestaUsuarioReal);
    }

    @Test
    @DisplayName("al superar el umbral responde 429 con Retry-After")
    void superarElUmbralDevuelve429() throws Exception {
        credencialesInvalidas();

        for (int i = 0; i < 3; i++) {
            intentar("cajera", "mala").andExpect(status().isUnauthorized());
        }

        intentar("cajera", "mala")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429));
    }

    @Test
    @DisplayName("el bloqueo alcanza también a la contraseña correcta mientras dura")
    void bloqueoIgnoraLaContrasenaCorrecta() throws Exception {
        credencialesInvalidas();
        for (int i = 0; i < 3; i++) {
            intentar("cajera", "mala");
        }

        credencialesValidas();
        intentar("cajera", "correcta").andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("vencida la ventana de bloqueo el acceso se recupera")
    void trasElBloqueoSeRecupera() throws Exception {
        credencialesInvalidas();
        for (int i = 0; i < 3; i++) {
            intentar("cajera", "mala");
        }
        intentar("cajera", "mala").andExpect(status().isTooManyRequests());

        avanzar(Duration.ofMinutes(16));

        credencialesValidas();
        intentar("cajera", "correcta").andExpect(status().isOk());
    }

    @Test
    @DisplayName("un login correcto limpia los fallos acumulados")
    void loginCorrectoReiniciaElContador() throws Exception {
        credencialesInvalidas();
        intentar("cajera", "mala");
        intentar("cajera", "mala");

        credencialesValidas();
        intentar("cajera", "correcta").andExpect(status().isOk());

        // Con el contador limpio vuelven a caber tres fallos antes del bloqueo.
        credencialesInvalidas();
        intentar("cajera", "mala").andExpect(status().isUnauthorized());
        intentar("cajera", "mala").andExpect(status().isUnauthorized());
        intentar("cajera", "mala").andExpect(status().isUnauthorized());
        intentar("cajera", "mala").andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("el usuario se normaliza: variar mayúsculas no multiplica los intentos")
    void variarMayusculasNoEsquivaElFreno() throws Exception {
        credencialesInvalidas();

        intentar("cajera", "mala").andExpect(status().isUnauthorized());
        intentar("CAJERA", "mala").andExpect(status().isUnauthorized());
        intentar("Cajera", "mala").andExpect(status().isUnauthorized());

        intentar("cAjErA", "mala").andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("bloquear a un usuario no bloquea a otro desde la misma IP")
    void elBloqueoNoAlcanzaAOtrasCuentas() throws Exception {
        credencialesInvalidas();
        for (int i = 0; i < 4; i++) {
            intentar("cajera", "mala");
        }

        credencialesValidas();
        intentar("supervisor", "correcta").andExpect(status().isOk());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    // doThrow/doReturn y no when(...): re-estubar con when() invocaría el mock,
    // que en ese momento aún está configurado para lanzar.

    private void credencialesInvalidas() {
        org.mockito.Mockito.doThrow(new BadCredentialsException("Bad credentials"))
                .when(authenticationManager).authenticate(any());
    }

    private void credencialesValidas() {
        org.mockito.Mockito.doReturn(null)
                .when(authenticationManager).authenticate(any());
    }

    private ResultActions intentar(String username, String password) throws Exception {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(1L);
        usuario.setUsername(username);
        usuario.setEmail(username + "@maxli.com");
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setRequiereCambioPassword(false);
        usuario.setRoles(new HashSet<>());
        when(usuarioRepository.findByUsername(username)).thenReturn(Optional.of(usuario));

        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setUsername(username);
        dto.setPassword(password);

        return mockMvc.perform(post("/api/auth/login")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(dto)));
    }
}
