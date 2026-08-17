package com.maxli.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxli.auth.controller.AuthController;
import com.maxli.auth.dto.LoginRequestDTO;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.config.ClockConfig;
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
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un usuario cuya sesión fue invalidada —cambio de contraseña, reset,
 * suspensión— conserva la cookie en el navegador, que se adjunta sola en cada
 * petición. Si esa cookie caduca el intento de <b>volver a entrar</b>, el
 * usuario queda encerrado fuera hasta que la cookie expire por su cuenta.
 *
 * <p>Login y logout tienen que seguir funcionando con una cookie inservible
 * encima: son justamente las dos operaciones que permiten salir de ese estado.
 */
@ActiveProfiles("test")   // el perfil es obligatorio desde ISSUE-010
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        LoginAttemptService.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-cookie-invalida-maxli-erp-2026-larga-de-sobra",
        "cors.allowed-origins=https://erp.plazamax.do",
        // Este slice habla HTTP en claro; la exigencia de HTTPS se prueba
        // aparte, en TransporteHttpsProduccionTest.
        "maxli.security.require-https=false"
})
@DisplayName("Login y logout con una cookie de sesión ya inservible")
class LoginConCookieInvalidaTest {

    private static final String USUARIO = "cajera";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;

    private Usuario usuario;

    @BeforeEach
    void prepararUsuario() {
        usuario = new Usuario();
        usuario.setIdUsuario(4L);
        usuario.setUsername(USUARIO);
        usuario.setEmail("cajera@maxli.com");
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setRequiereCambioPassword(false);
        usuario.setRoles(new HashSet<>());
        // La cuenta va por la versión 9; la cookie del navegador quedó en la 8.
        usuario.setTokenVersion(9);

        when(usuarioRepository.findByUsername(USUARIO)).thenReturn(Optional.of(usuario));
    }

    @Test
    @DisplayName("se puede iniciar sesión aunque el navegador mande una cookie invalidada")
    void loginFuncionaConCookieDeVersionAntigua() throws Exception {
        when(authenticationManager.authenticate(any())).thenReturn(null);

        MvcResult resultado = mockMvc.perform(post("/api/auth/login")
                        .cookie(cookieDeVersionAntigua())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales())))
                .andExpect(status().isOk())
                .andReturn();

        String nueva = resultado.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(cabecera -> cabecera.startsWith("maxli_session="))
                .findFirst()
                .orElse(null);

        assertThat(nueva)
                .as("el login debe reemplazar la cookie inservible por una nueva")
                .isNotNull()
                .doesNotContain("maxli_session=;");
    }

    @Test
    @DisplayName("se puede iniciar sesión con una cookie con firma corrupta")
    void loginFuncionaConCookieCorrupta() throws Exception {
        when(authenticationManager.authenticate(any())).thenReturn(null);

        mockMvc.perform(post("/api/auth/login")
                        .cookie(new Cookie("maxli_session", "esto.no.es-un-jwt"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales())))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("un login con credenciales malas y cookie invalidada sigue devolviendo 401, no otra cosa")
    void loginFallidoConCookieInvalidaDevuelve401() throws Exception {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Bad"));

        mockMvc.perform(post("/api/auth/login")
                        .cookie(cookieDeVersionAntigua())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("el logout puede borrar una cookie ya invalidada")
    void logoutBorraCookieInvalidada() throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/auth/logout")
                        .cookie(cookieDeVersionAntigua())
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent())
                .andReturn();

        assertThat(resultado.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .as("sin esto el navegador conserva la cookie muerta indefinidamente")
                .anyMatch(cabecera -> cabecera.startsWith("maxli_session=")
                        && cabecera.contains("Max-Age=0"));
    }

    @Test
    @DisplayName("el logout también borra una cookie con firma corrupta")
    void logoutBorraCookieCorrupta() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie("maxli_session", "esto.no.es-un-jwt"))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("una cookie invalidada sigue sin dar acceso a un endpoint protegido")
    void laCookieInvalidadaNoAbreNingunaPuerta() throws Exception {
        mockMvc.perform(get("/api/auth/me").cookie(cookieDeVersionAntigua()))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Cookie cookieDeVersionAntigua() {
        UserDetails detalles = User.withUsername(USUARIO)
                .password("hash")
                .authorities(List.of())
                .build();
        return new Cookie("maxli_session", jwtUtil.generarToken(detalles, 8));
    }

    private LoginRequestDTO credenciales() {
        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setUsername(USUARIO);
        dto.setPassword("Password#2026");
        return dto;
    }
}
