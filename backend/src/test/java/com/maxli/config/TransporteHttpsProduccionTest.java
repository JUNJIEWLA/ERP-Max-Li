package com.maxli.config;

import com.maxli.auth.controller.AuthController;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.exception.GlobalExceptionHandler;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.filter.ForwardedHeaderFilter;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ISSUE-010 — Contrato de transporte del despliegue productivo: TLS lo termina
 * un reverse proxy confiable que reenvía {@code X-Forwarded-*}; la aplicación
 * no atiende nada en texto plano y publica HSTS y cabeceras de seguridad.
 *
 * <p>El {@link ForwardedHeaderFilter} se monta explícitamente delante de la
 * cadena de seguridad, que es lo que hace en producción
 * {@code server.forward-headers-strategy: framework}. Sin él, toda petición
 * parecería llegar en claro y el sitio entraría en un bucle de redirecciones.
 */
@ActiveProfiles("test")   // el perfil es obligatorio desde ISSUE-010
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        LoginAttemptService.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-transporte-maxli-erp-2026-larga-de-sobra-ya",
        "cors.allowed-origins=https://erp.plazamax.do",
        "maxli.security.require-https=true",
        "maxli.security.cookie.secure=true"
})
@DisplayName("Transporte en producción — HTTPS obligatorio y cabeceras de seguridad")
class TransporteHttpsProduccionTest {

    @Autowired private WebApplicationContext contexto;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;

    private MockMvc mockMvc;

    @BeforeEach
    void montarCadenaComoDetrasDelProxy() {
        mockMvc = MockMvcBuilders.webAppContextSetup(contexto)
                .addFilters(new ForwardedHeaderFilter())
                .apply(springSecurity())
                .build();
    }

    @Test
    @DisplayName("una petición en texto plano se redirige a https")
    void redirigeTextoPlanoAHttps() throws Exception {
        mockMvc.perform(get("http://erp.plazamax.do/api/auth/me"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", Matchers.startsWith("https://")));
    }

    @Test
    @DisplayName("X-Forwarded-Proto: https del proxy confiable se reconoce como tráfico cifrado")
    void reconoceForwardedProtoDelProxy() throws Exception {
        mockMvc.perform(get("http://erp.plazamax.do/api/auth/me")
                        .header("X-Forwarded-Proto", "https")
                        .header("X-Forwarded-Host", "erp.plazamax.do"))
                // Ya no redirige: llega a la cadena y responde 401 por falta de sesión.
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("X-Forwarded-Proto: http sigue considerándose texto plano")
    void forwardedProtoEnClaroSigueRedirigiendo() throws Exception {
        mockMvc.perform(get("http://erp.plazamax.do/api/auth/me")
                        .header("X-Forwarded-Proto", "http"))
                .andExpect(status().is3xxRedirection());
    }

    @Test
    @DisplayName("el tráfico cifrado trae HSTS y las cabeceras de seguridad esperadas")
    void emiteCabecerasDeSeguridad() throws Exception {
        mockMvc.perform(get("/api/auth/me").secure(true))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Strict-Transport-Security",
                        Matchers.containsString("max-age=31536000")))
                .andExpect(header().string("Strict-Transport-Security",
                        Matchers.containsString("includeSubDomains")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "same-origin"));
    }
}
