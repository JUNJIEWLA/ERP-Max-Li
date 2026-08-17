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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * El token CSRF debe seguir estando disponible después de cada petición
 * mutante.
 *
 * <p>El SPA no guarda el token: lo lee de la cookie {@code XSRF-TOKEN} justo
 * antes de cada petición. Si una respuesta borra esa cookie sin reemitirla, la
 * siguiente mutación sale sin cabecera {@code X-XSRF-TOKEN} y el backend la
 * rechaza con 403 — aunque la sesión sea válida y el usuario tenga permiso.
 *
 * <p>Eso es exactamente lo que ocurre en el cobro del POS, donde
 * {@code POST /api/ventas/recalcular} precede de inmediato a
 * {@code POST /api/ventas}: la venta fallaba al primer clic en «Cobrar».
 *
 * <p>Por eso esta prueba <b>no</b> usa {@code .with(csrf())}: ese ayudante
 * fabrica un token válido de la nada en cada petición y oculta justo el defecto
 * que aquí se vigila. Se trabaja con un tarro de cookies que imita al navegador
 * —aplica cada {@code Set-Cookie} recibido, incluidos los borrados— y con la
 * cabecera real.
 */
@ActiveProfiles("test")
@WebMvcTest(controllers = {AuthController.class, ProveedorController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        LoginAttemptService.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=clave-de-pruebas-csrf-reemitido-maxli-erp-2026-suficientemente-larga",
        "jwt.expiration=8h",
        "cors.allowed-origins=http://localhost:5173",
        "maxli.security.cookie.name=maxli_session",
        "maxli.security.require-https=false"
})
@DisplayName("Token CSRF disponible tras cada mutación")
class CsrfTokenReemitidoTest {

    private static final String USUARIO = "cajera";
    private static final String CLAVE = "Password#2026";
    private static final String COOKIE_CSRF = "XSRF-TOKEN";
    private static final String CABECERA_CSRF = "X-XSRF-TOKEN";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;
    @MockBean private ProveedorService proveedorService;

    /** Cookies que el navegador conservaría entre peticiones. */
    private final Map<String, String> navegador = new LinkedHashMap<>();

    @BeforeEach
    void prepararUsuario() {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(7L);
        usuario.setUsername(USUARIO);
        usuario.setEmail("cajera@maxli.com");
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setTokenVersion(3);
        usuario.setRequiereCambioPassword(false);

        Permiso permiso = new Permiso();
        permiso.setNombreClave("PROVEEDOR_GESTIONAR");
        Rol rol = new Rol();
        rol.setNombre("ADMIN");
        rol.setPermisos(Set.of(permiso));
        usuario.setRoles(new HashSet<>(Set.of(rol)));

        when(usuarioRepository.findByUsername(USUARIO)).thenReturn(Optional.of(usuario));
        when(authenticationManager.authenticate(any())).thenReturn(null);
        when(proveedorService.crear(any())).thenReturn(new ProveedorResponseDTO());
    }

    @Test
    @DisplayName("dos mutaciones consecutivas funcionan con el estado de cookies del navegador")
    void dosMutacionesConsecutivasNoPierdenElToken() throws Exception {
        login();
        assertThat(navegador).containsKey(COOKIE_CSRF);

        MockHttpServletResponse primera = mutar();
        assertThat(primera.getStatus())
                .as("la primera mutación con cookie de sesión y token CSRF debe aceptarse")
                .isEqualTo(201);

        assertThat(navegador)
                .as("tras una mutación el navegador debe seguir teniendo un token CSRF que enviar")
                .containsKey(COOKIE_CSRF);

        MockHttpServletResponse segunda = mutar();
        assertThat(segunda.getStatus())
                .as("la segunda mutación consecutiva no puede rechazarse: es el cobro del POS, "
                        + "que hace /ventas/recalcular y acto seguido /ventas")
                .isEqualTo(201);
    }

    @Test
    @DisplayName("una mutación sin token CSRF se sigue rechazando")
    void sinTokenCsrfSigueSiendoRechazada() throws Exception {
        login();

        mockMvc.perform(peticionDeMutacion(null))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("una mutación con un token CSRF ajeno se sigue rechazando")
    void conTokenCsrfIncorrectoSigueSiendoRechazada() throws Exception {
        login();

        mockMvc.perform(peticionDeMutacion("token-de-otro-sitio"))
                .andExpect(status().isForbidden());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void login() throws Exception {
        LoginRequestDTO credenciales = new LoginRequestDTO();
        credenciales.setUsername(USUARIO);
        credenciales.setPassword(CLAVE);

        MvcResult resultado = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(credenciales)))
                .andExpect(status().isOk())
                .andReturn();

        aplicarCookies(resultado.getResponse());
    }

    /** Mutación tal y como la enviaría el SPA: cookies vigentes + token de la cookie. */
    private MockHttpServletResponse mutar() throws Exception {
        MvcResult resultado = mockMvc.perform(peticionDeMutacion(navegador.get(COOKIE_CSRF))).andReturn();
        aplicarCookies(resultado.getResponse());
        return resultado.getResponse();
    }

    private MockHttpServletRequestBuilder peticionDeMutacion(String tokenCsrf) throws Exception {
        ProveedorRequestDTO proveedor = new ProveedorRequestDTO();
        proveedor.setNombreEmpresa("Distribuidora Máx");
        proveedor.setRnc("131000001");

        MockHttpServletRequestBuilder peticion = post("/api/proveedores")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(proveedor));

        navegador.forEach((nombre, valor) -> peticion.cookie(new Cookie(nombre, valor)));
        if (tokenCsrf != null) {
            peticion.header(CABECERA_CSRF, tokenCsrf);
        }
        return peticion;
    }

    /** Imita al navegador: guarda las cookies nuevas y descarta las borradas. */
    private void aplicarCookies(MockHttpServletResponse response) {
        for (Cookie cookie : response.getCookies()) {
            boolean borrada = cookie.getMaxAge() == 0
                    || cookie.getValue() == null
                    || cookie.getValue().isEmpty();
            if (borrada) {
                navegador.remove(cookie.getName());
            } else {
                navegador.put(cookie.getName(), cookie.getValue());
            }
        }
    }
}
