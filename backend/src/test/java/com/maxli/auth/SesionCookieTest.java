package com.maxli.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxli.auth.controller.AuthController;
import com.maxli.auth.dto.LoginRequestDTO;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.compra.controller.ProveedorController;
import com.maxli.compra.dto.ProveedorRequestDTO;
import com.maxli.compra.dto.ProveedorResponseDTO;
import com.maxli.compra.service.ProveedorService;
import com.maxli.config.ClockConfig;
import com.maxli.config.JsonAuthResponseHandler;
import com.maxli.config.JwtAuthFilter;
import com.maxli.config.JwtUtil;
import com.maxli.config.SecurityConfig;
import com.maxli.config.SessionCookieService;
import com.maxli.config.UserDetailsServiceImpl;
import com.maxli.exception.GlobalExceptionHandler;
import com.maxli.permiso.entity.Permiso;
import com.maxli.rol.entity.Rol;
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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ISSUE-010 — La sesión deja de vivir en {@code localStorage} y pasa a una
 * cookie {@code HttpOnly}, con protección CSRF, logout real y recuperación de
 * sesión por {@code /api/auth/me}.
 */
@WebMvcTest(controllers = {AuthController.class, ProveedorController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        LoginAttemptService.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-sesion-cookie-maxli-erp-2026-suficientemente-larga",
        "jwt.expiration=8h",
        "cors.allowed-origins=http://localhost:5173",
        "maxli.security.cookie.name=maxli_session"
})
@DisplayName("Sesión en cookie HttpOnly")
class SesionCookieTest {

    private static final String USUARIO = "cajera";
    private static final String CLAVE = "Password#2026";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;
    @MockBean private ProveedorService proveedorService;

    private Usuario usuario;

    @BeforeEach
    void prepararUsuario() {
        usuario = new Usuario();
        usuario.setIdUsuario(7L);
        usuario.setUsername(USUARIO);
        usuario.setEmail("cajera@maxli.com");
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setTokenVersion(3);
        // Sin esto la entidad arranca en true y el usuario solo tendría la
        // autoridad PWD_CHANGE_REQUIRED, que no es el escenario de esta prueba.
        usuario.setRequiereCambioPassword(false);

        Permiso permiso = new Permiso();
        permiso.setNombreClave("PROVEEDOR_GESTIONAR");
        Rol rol = new Rol();
        rol.setNombre("ADMIN");
        rol.setPermisos(Set.of(permiso));
        usuario.setRoles(new HashSet<>(Set.of(rol)));

        when(usuarioRepository.findByUsername(USUARIO)).thenReturn(Optional.of(usuario));
        when(proveedorService.crear(any())).thenReturn(new ProveedorResponseDTO());
    }

    @Test
    @DisplayName("el login entrega el JWT en una cookie HttpOnly y no en el cuerpo")
    void loginDejaElTokenFueraDelAlcanceDeJavaScript() throws Exception {
        MvcResult resultado = login();

        // La respuesta trae varias Set-Cookie (sesión y XSRF-TOKEN): hay que
        // localizar la de sesión, no quedarse con la primera.
        String setCookie = resultado.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(cabecera -> cabecera.startsWith("maxli_session="))
                .findFirst()
                .orElse(null);

        assertThat(setCookie)
                .as("la cookie de sesión debe ser inaccesible desde el script de la página")
                .isNotNull()
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .contains("Path=/");

        assertThat(resultado.getResponse().getContentAsString())
                .as("el cuerpo del login no debe transportar el token")
                .doesNotContain("token");
    }

    @Test
    @DisplayName("expiresIn refleja la expiración configurada, no un valor escrito a mano")
    void expiresInSaleDeLaConfiguracion() throws Exception {
        long ochoHorasEnMs = 8L * 60 * 60 * 1000;

        when(authenticationManager.authenticate(any())).thenReturn(null);

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresIn").value(ochoHorasEnMs));
    }

    @Test
    @DisplayName("la cookie de sesión autentica las peticiones siguientes")
    void laCookieAutentica() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        mockMvc.perform(get("/api/auth/me").cookie(sesion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(USUARIO))
                .andExpect(jsonPath("$.permisos[0]").value("PROVEEDOR_GESTIONAR"));
    }

    @Test
    @DisplayName("/api/auth/me devuelve la identidad para recuperar la sesión al recargar")
    void meRecuperaLaSesion() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        mockMvc.perform(get("/api/auth/me").cookie(sesion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(USUARIO))
                .andExpect(jsonPath("$.email").value("cajera@maxli.com"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.requiereCambioPassword").value(false));
    }

    @Test
    @DisplayName("el logout borra la cookie de sesión")
    void logoutBorraLaCookie() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        MvcResult resultado = mockMvc.perform(post("/api/auth/logout")
                        .cookie(sesion)
                        .header("X-XSRF-TOKEN", "irrelevante")
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent())
                .andReturn();

        assertThat(resultado.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .contains("maxli_session=")
                .contains("Max-Age=0");
    }

    @Test
    @DisplayName("una petición mutante con cookie pero sin token CSRF se rechaza")
    void sinTokenCsrfNoSeMuta() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        mockMvc.perform(post("/api/proveedores")
                        .cookie(sesion)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ProveedorRequestDTO())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("la misma petición con token CSRF válido se acepta")
    void conTokenCsrfSeMuta() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        mockMvc.perform(post("/api/proveedores")
                        .cookie(sesion)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorValido())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("un token emitido antes de cambiar la contraseña deja de servir")
    void tokenPrevioAlCambioDeContrasenaQuedaInvalidado() throws Exception {
        Cookie sesion = cookieDeSesion(login().getResponse());

        // El servicio incrementa tokenVersion en cada cambio/reset/suspensión.
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);

        mockMvc.perform(get("/api/auth/me").cookie(sesion))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("un token sin el claim de versión tampoco sobrevive a un cambio de cuenta")
    void tokenSinClaimDeVersionSeRechaza() throws Exception {
        UserDetails detalles = User.withUsername(USUARIO).password("hash").authorities(java.util.List.of()).build();
        // -1 es el valor que devuelve extraerTokenVersion cuando el claim falta.
        String tokenLegacy = jwtUtil.generarToken(detalles, -1);

        mockMvc.perform(get("/api/auth/me").cookie(new Cookie("maxli_session", tokenLegacy)))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private MvcResult login() throws Exception {
        when(authenticationManager.authenticate(any())).thenReturn(null);
        return mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales())))
                .andExpect(status().isOk())
                .andReturn();
    }

    private LoginRequestDTO credenciales() {
        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setUsername(USUARIO);
        dto.setPassword(CLAVE);
        return dto;
    }

    private Cookie cookieDeSesion(MockHttpServletResponse response) {
        Cookie cookie = response.getCookie("maxli_session");
        assertThat(cookie).as("el login debe emitir la cookie de sesión").isNotNull();
        return cookie;
    }

    private ProveedorRequestDTO proveedorValido() {
        ProveedorRequestDTO dto = new ProveedorRequestDTO();
        dto.setNombreEmpresa("Distribuidora Máx");
        dto.setRnc("131000001");
        return dto;
    }
}
