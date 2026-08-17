package com.maxli.config;

import com.maxli.auth.controller.AuthController;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.exception.GlobalExceptionHandler;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ISSUE-010 — CORS deja de estar fijado a localhost en el código y se toma de
 * {@code CORS_ALLOWED_ORIGINS}. Se comprueba con orígenes productivos, de modo
 * que localhost solo pasaría si estuviera explícitamente declarado.
 */
@ActiveProfiles("test")   // el perfil es obligatorio desde ISSUE-010
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        LoginAttemptService.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-cors-maxli-erp-2026-suficientemente-larga-ok",
        "cors.allowed-origins=https://erp.plazamax.do,https://caja.plazamax.do",
        // Este slice habla HTTP en claro; la exigencia de HTTPS se prueba
        // aparte, en TransporteHttpsProduccionTest.
        "maxli.security.require-https=false"
})
@DisplayName("CORS admite exclusivamente los orígenes configurados")
class CorsConfiguradoTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;

    @Test
    @DisplayName("acepta el primer origen declarado")
    void aceptaOrigenDeclarado() throws Exception {
        mockMvc.perform(options("/api/auth/me")
                        .header("Origin", "https://erp.plazamax.do")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://erp.plazamax.do"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    @DisplayName("acepta también el segundo origen: la lista admite varios explícitos")
    void aceptaSegundoOrigenDeclarado() throws Exception {
        mockMvc.perform(options("/api/auth/me")
                        .header("Origin", "https://caja.plazamax.do")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://caja.plazamax.do"));
    }

    @Test
    @DisplayName("rechaza un origen no declarado")
    void rechazaOrigenAjeno() throws Exception {
        mockMvc.perform(options("/api/auth/me")
                        .header("Origin", "https://atacante.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("rechaza el localhost de desarrollo cuando no forma parte de la lista")
    void rechazaLocalhostSiNoEstaDeclarado() throws Exception {
        mockMvc.perform(options("/api/auth/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
