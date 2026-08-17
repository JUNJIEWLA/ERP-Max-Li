package com.maxli.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxli.auth.controller.AuthController;
import com.maxli.auth.dto.CambiarPasswordDTO;
import com.maxli.caja.controller.TurnoCajaController;
import com.maxli.caja.dto.AbrirTurnoCajaRequestDTO;
import com.maxli.caja.dto.TurnoCajaResponseDTO;
import com.maxli.caja.service.TurnoCajaService;
import com.maxli.compra.controller.ProveedorController;
import com.maxli.compra.dto.ProveedorRequestDTO;
import com.maxli.compra.dto.ProveedorResponseDTO;
import com.maxli.compra.service.ProveedorService;
import com.maxli.gasto.controller.GastoController;
import com.maxli.gasto.dto.GastoResponseDTO;
import com.maxli.gasto.service.GastoService;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.ncf.controller.NcfController;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.dto.ResolucionNcfRequestDTO;
import com.maxli.ncf.service.NcfService;
import com.maxli.permiso.entity.Permiso;
import com.maxli.rol.entity.Rol;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica que la autorización de endpoints sensibles la decide el backend
 * mediante permisos reales (GrantedAuthority), no solo el nombre del rol
 * ni lo que oculta el frontend. Cubre el hallazgo ISSUE-011.
 */
@WebMvcTest(controllers = {ProveedorController.class, GastoController.class, NcfController.class,
        AuthController.class, TurnoCajaController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, UserDetailsServiceImpl.class,
        JsonAuthResponseHandler.class, SessionCookieService.class, ClockConfig.class,
        com.maxli.auth.service.LoginAttemptService.class,
        com.maxli.exception.GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "jwt.secret=test-secret-key-minimo-256-bits-para-pruebas-de-autorizacion-backend",
        "jwt.expiration=86400000",
        "cors.allowed-origins=http://localhost:5173"
})
class AutorizacionEndpointsTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private UsuarioRepository usuarioRepository;
    @MockBean private ProveedorService proveedorService;
    @MockBean private GastoService gastoService;
    @MockBean private NcfService ncfService;
    @MockBean private TurnoCajaService turnoCajaService;
    @MockBean private UsuarioService usuarioService;
    @MockBean private AuthenticationManager authenticationManager;

    @BeforeEach
    void stubDefaults() {
        when(proveedorService.crear(any())).thenReturn(new ProveedorResponseDTO());
        when(gastoService.listar(any())).thenReturn(new PageImpl<GastoResponseDTO>(List.of()));
        when(ncfService.generarSiguienteNcf(anyString())).thenReturn(new NcfGeneradoDTO());
        when(ncfService.previsualizarSiguienteNcf(anyString())).thenReturn(new NcfGeneradoDTO());
        when(turnoCajaService.abrir(any(), anyString())).thenReturn(new TurnoCajaResponseDTO());
    }

    // ── ADMIN puede realizar operaciones administrativas ──────────────────

    @Test
    void admin_puede_crear_proveedor() throws Exception {
        String token = tokenPara(usuarioConRoles("admin1", "ADMIN"));

        mockMvc.perform(post("/api/proveedores")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    void admin_no_puede_consumir_ncf_directamente() throws Exception {
        String token = tokenPara(usuarioConRoles("admin2", "ADMIN"));

        mockMvc.perform(post("/api/ncf/generar/B01")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void errores_de_dominio_ncf_devuelven_json_consistente() throws Exception {
        String token = tokenPara(usuarioConRoles("admin-ncf-error", "ADMIN"));
        when(ncfService.crearResolucion(any())).thenThrow(
                new DuplicateResourceException("Ya existe una resolución activa para B02"));

        mockMvc.perform(post("/api/ncf")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(resolucionRequest())))
                .andExpect(status().isConflict())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value(409))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.error").value("Ya existe una resolución activa para B02"));
    }

    // ── CAJERO no puede crear proveedores ni leer gastos administrativos ──

    @Test
    void cajero_no_puede_crear_proveedor() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero1", "CAJERO"));

        mockMvc.perform(post("/api/proveedores")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorRequest())))
                .andExpect(status().isForbidden());
    }

    @Test
    void cajero_no_puede_leer_gastos() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero2", "CAJERO"));

        mockMvc.perform(get("/api/gastos")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void cajero_puede_abrir_su_propio_turno_sin_gestionar_usuarios() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero-turno", "CAJERO"));

        mockMvc.perform(post("/api/cajas/turnos/abrir")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(abrirTurnoRequest())))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/usuarios/activos")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void operacion_de_turno_ajeno_devuelve_403() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero-turno-ajeno", "CAJERO"));
        when(turnoCajaService.abrir(any(), anyString())).thenThrow(
                new AccessDeniedException("No tiene permiso para abrir un turno a nombre de otro usuario"));

        mockMvc.perform(post("/api/cajas/turnos/abrir")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(abrirTurnoRequest())))
                .andExpect(status().isForbidden())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value(403));
    }

    // ── CAJERO no puede consumir NCF directamente, pero sí previsualizarlo ─

    @Test
    void cajero_no_puede_generar_ncf() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero3", "CAJERO"));

        mockMvc.perform(post("/api/ncf/generar/B01")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void cajero_si_puede_previsualizar_ncf() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero4", "CAJERO"));

        mockMvc.perform(get("/api/ncf/preview/B01")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    // ── Usuario con cambio de contraseña pendiente: solo sesión/password ──

    @Test
    void usuario_con_password_pendiente_no_puede_operar_negocio() throws Exception {
        Usuario usuario = usuarioConRoles("pendiente1", "ADMIN");
        usuario.setRequiereCambioPassword(true);
        String token = tokenPara(usuario);

        mockMvc.perform(post("/api/proveedores")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorRequest())))
                .andExpect(status().isForbidden());
    }

    @Test
    void usuario_con_password_pendiente_puede_consultar_su_sesion() throws Exception {
        Usuario usuario = usuarioConRoles("pendiente2", "ADMIN");
        usuario.setRequiereCambioPassword(true);
        String token = tokenPara(usuario);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void usuario_con_password_pendiente_puede_cambiar_su_password() throws Exception {
        Usuario usuario = usuarioConRoles("pendiente3", "ADMIN");
        usuario.setRequiereCambioPassword(true);
        String token = tokenPara(usuario);

        CambiarPasswordDTO dto = new CambiarPasswordDTO();
        dto.setPasswordActual("actual123");
        dto.setPasswordNueva("nueva12345");

        mockMvc.perform(post("/api/auth/cambiar-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
    }

    // ── Permiso personalizado ejecuta exactamente esa operación ───────────

    @Test
    void usuario_sin_rol_con_permiso_proveedor_gestionar_puede_crear_proveedor() throws Exception {
        Usuario usuario = usuarioSinRoles("independiente1");
        usuario.setPermisosExtra(Set.of(permiso("PROVEEDOR_GESTIONAR")));
        String token = tokenPara(usuario);

        mockMvc.perform(post("/api/proveedores")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    void usuario_sin_rol_con_permiso_proveedor_gestionar_no_puede_leer_gastos() throws Exception {
        Usuario usuario = usuarioSinRoles("independiente2");
        usuario.setPermisosExtra(Set.of(permiso("PROVEEDOR_GESTIONAR")));
        String token = tokenPara(usuario);

        mockMvc.perform(get("/api/gastos")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // ── Quitar un permiso produce 403, sin frontend de por medio ──────────

    @Test
    void supervisor_sin_permiso_proveedor_gestionar_recibe_403() throws Exception {
        // Simula un SUPERVISOR al que se le revocó PROVEEDOR_GESTIONAR en la BD:
        // el rol solo conserva permisos operativos, no de proveedores.
        Rol supervisorSinProveedores = rol("SUPERVISOR", permiso("VENTA_VER"), permiso("REPORTE_VER"));
        Usuario usuario = usuario("supervisor1", supervisorSinProveedores);
        String token = tokenPara(usuario);

        mockMvc.perform(post("/api/proveedores")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(proveedorRequest())))
                .andExpect(status().isForbidden());
    }

    // ── 401 vs 403 consistentes ────────────────────────────────────────

    @Test
    void sin_token_devuelve_401() throws Exception {
        mockMvc.perform(get("/api/gastos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void con_token_valido_pero_sin_autoridad_devuelve_403() throws Exception {
        String token = tokenPara(usuarioConRoles("cajero5", "CAJERO"));

        mockMvc.perform(get("/api/gastos")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private String tokenPara(Usuario usuario) {
        when(usuarioRepository.findByUsername(usuario.getUsername()))
                .thenReturn(Optional.of(usuario));
        UserDetails details = User.withUsername(usuario.getUsername())
                .password(usuario.getPasswordHash())
                .authorities(List.of())
                .build();
        return jwtUtil.generarToken(details, usuario.getTokenVersion());
    }

    private Usuario usuarioConRoles(String username, String... nombresRol) {
        Set<Rol> roles = new HashSet<>();
        for (String nombreRol : nombresRol) {
            roles.add(rolCompleto(nombreRol));
        }
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setRequiereCambioPassword(false);
        usuario.setTokenVersion(0);
        usuario.setRoles(roles);
        usuario.setPermisosExtra(Set.of());
        return usuario;
    }

    private Usuario usuarioSinRoles(String username) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setRequiereCambioPassword(false);
        usuario.setTokenVersion(0);
        usuario.setRoles(Set.of());
        usuario.setPermisosExtra(Set.of());
        return usuario;
    }

    private Usuario usuario(String username, Rol... roles) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPasswordHash("hash");
        usuario.setEstado("ACTIVO");
        usuario.setRequiereCambioPassword(false);
        usuario.setTokenVersion(0);
        usuario.setRoles(new HashSet<>(Set.of(roles)));
        usuario.setPermisosExtra(Set.of());
        return usuario;
    }

    /** Reconstruye los permisos reales sembrados en V21 para el rol dado. */
    private Rol rolCompleto(String nombreRol) {
        return switch (nombreRol) {
            case "ADMIN" -> rol("ADMIN",
                    permiso("USUARIO_GESTIONAR"), permiso("ROL_GESTIONAR"),
                    permiso("PRODUCTO_VER"), permiso("PRODUCTO_GESTIONAR"),
                    permiso("INVENTARIO_VER"), permiso("INVENTARIO_GESTIONAR"),
                    permiso("VENTA_CREAR"), permiso("VENTA_VER"), permiso("VENTA_ANULAR"),
                    permiso("CAJA_OPERAR"), permiso("CAJA_GESTIONAR"),
                    permiso("COMPRA_GESTIONAR"), permiso("PROVEEDOR_GESTIONAR"),
                    permiso("DEVOLUCION_CREAR"), permiso("CLIENTE_GESTIONAR"),
                    permiso("REPORTE_VER"), permiso("CONFIGURACION_VER"),
                    permiso("NOMINA_GESTIONAR"), permiso("CONTABILIDAD_VER"),
                    permiso("NCF_GESTIONAR"), permiso("CUPON_GESTIONAR"), permiso("ALMACEN_GESTIONAR"));
            case "SUPERVISOR" -> rol("SUPERVISOR",
                    permiso("PRODUCTO_VER"), permiso("PRODUCTO_GESTIONAR"),
                    permiso("INVENTARIO_VER"), permiso("INVENTARIO_GESTIONAR"),
                    permiso("VENTA_CREAR"), permiso("VENTA_VER"), permiso("VENTA_ANULAR"),
                    permiso("CAJA_OPERAR"),
                    permiso("COMPRA_GESTIONAR"), permiso("PROVEEDOR_GESTIONAR"),
                    permiso("DEVOLUCION_CREAR"), permiso("CLIENTE_GESTIONAR"),
                    permiso("REPORTE_VER"));
            case "CAJERO" -> rol("CAJERO",
                    permiso("PRODUCTO_VER"), permiso("INVENTARIO_VER"),
                    permiso("VENTA_CREAR"), permiso("VENTA_VER"),
                    permiso("CAJA_OPERAR"), permiso("CLIENTE_GESTIONAR"));
            case "AUXILIAR_INVENTARIO" -> rol("AUXILIAR_INVENTARIO",
                    permiso("PRODUCTO_VER"), permiso("INVENTARIO_VER"));
            default -> throw new IllegalArgumentException("Rol de prueba no definido: " + nombreRol);
        };
    }

    private Rol rol(String nombre, Permiso... permisos) {
        Rol rol = new Rol();
        rol.setNombre(nombre);
        rol.setPermisos(new HashSet<>(Set.of(permisos)));
        return rol;
    }

    private Permiso permiso(String nombreClave) {
        Permiso permiso = new Permiso();
        permiso.setNombreClave(nombreClave);
        return permiso;
    }

    private ProveedorRequestDTO proveedorRequest() {
        ProveedorRequestDTO dto = new ProveedorRequestDTO();
        dto.setNombreEmpresa("Proveedor de prueba");
        dto.setRnc("123456789");
        return dto;
    }

    private ResolucionNcfRequestDTO resolucionRequest() {
        ResolucionNcfRequestDTO dto = new ResolucionNcfRequestDTO();
        dto.setTipoNcf("B02");
        dto.setDescripcion("Consumo");
        dto.setNumeroResolucion("RES-B02");
        dto.setPrefijo("B02");
        dto.setSecuenciaInicio(1L);
        dto.setSecuenciaFinal(100L);
        dto.setFechaVencimiento(java.time.LocalDate.now().plusDays(30));
        return dto;
    }

    private AbrirTurnoCajaRequestDTO abrirTurnoRequest() {
        AbrirTurnoCajaRequestDTO dto = new AbrirTurnoCajaRequestDTO();
        dto.setIdCaja(1L);
        dto.setMontoInicial(new BigDecimal("1000.00"));
        return dto;
    }
}
