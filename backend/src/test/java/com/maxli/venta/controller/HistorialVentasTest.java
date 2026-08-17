package com.maxli.venta.controller;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.cliente.entity.Cliente;
import com.maxli.cliente.repository.ClienteRepository;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.repository.RolRepository;
import com.maxli.support.PostgresIntegrationTest;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import com.maxli.venta.repository.VentaRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Historial de Ventas: listado real filtrado en servidor y detalle por ID.
 * <p>
 * La pantalla de historial es de solo lectura y no puede filtrar en el
 * navegador sobre la página que ya tiene: con miles de ventas, buscar un
 * número de control solo funciona si la consulta viaja al backend. Aquí se
 * comprueba contra PostgreSQL real que cada filtro recorta de verdad el
 * conjunto, que se combinan entre sí y que el permiso VENTA_VER manda.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Historial de Ventas — listado filtrado y detalle")
class HistorialVentasTest extends PostgresIntegrationTest {

    private static final String CAJERO_ANA = "cajero.hist.ana";
    private static final String CAJERO_BETO = "cajero.hist.beto";

    @Autowired private MockMvc mockMvc;
    @Autowired private VentaRepository ventaRepository;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private RolRepository rolRepository;
    @Autowired private AlmacenRepository almacenRepository;
    @Autowired private CajaRepository cajaRepository;
    @Autowired private TurnoCajaRepository turnoCajaRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idVenta001;

    @BeforeEach
    void sembrarHistorial() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_HIST");
            rol.setDescripcion("Rol de prueba del historial de ventas");
            rol = rolRepository.save(rol);

            Usuario ana = crearUsuario(CAJERO_ANA, rol);
            Usuario beto = crearUsuario(CAJERO_BETO, rol);

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Historial");
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja Historial");
            caja.setEstado("ACTIVO");
            caja.setAlmacen(almacen);
            caja = cajaRepository.save(caja);

            TurnoCaja turno = new TurnoCaja();
            turno.setCaja(caja);
            turno.setUsuarioApertura(ana);
            turno.setMontoInicial(new BigDecimal("1000.00"));
            turno.setEstado("ABIERTO");
            turno.setFechaApertura(LocalDateTime.now());
            turno = turnoCajaRepository.save(turno);

            Cliente maria = new Cliente();
            maria.setNombreCompleto("Maria Historica");
            maria.setRncCedula("001-0000000-1");
            maria.setEstado("ACTIVO");
            maria = clienteRepository.save(maria);

            // 001 — cliente registrado, efectivo, enero
            Venta v1 = nuevaVenta(turno, ana, almacen, "VT-HIST-001", "B0200000001", "B02",
                    MetodoPago.EFECTIVO, new BigDecimal("100.00"),
                    LocalDateTime.of(2026, 1, 10, 9, 0));
            v1.setCliente(maria);
            idVenta001 = ventaRepository.save(v1).getIdVenta();

            // 002 — cliente de paso, tarjeta, al filo de medianoche
            Venta v2 = nuevaVenta(turno, beto, almacen, "VT-HIST-002", "B0200000002", "B02",
                    MetodoPago.TARJETA, new BigDecimal("200.00"),
                    LocalDateTime.of(2026, 1, 15, 23, 45));
            v2.setNombreClienteTemporal("Pedro Pasajero");
            ventaRepository.save(v2);

            // 003 — sin NCF ni cliente, transferencia, febrero
            ventaRepository.save(nuevaVenta(turno, ana, almacen, "VT-HIST-003", null, null,
                    MetodoPago.TRANSFERENCIA, new BigDecimal("300.00"),
                    LocalDateTime.of(2026, 2, 1, 12, 0)));

            // 004 — cliente registrado, efectivo, febrero
            Venta v4 = nuevaVenta(turno, beto, almacen, "VT-HIST-004", "B0100000009", "B01",
                    MetodoPago.EFECTIVO, new BigDecimal("400.00"),
                    LocalDateTime.of(2026, 2, 20, 8, 0));
            v4.setCliente(maria);
            ventaRepository.save(v4);
        });
    }

    @AfterEach
    void limpiarHistorial() {
        jdbcTemplate.update("DELETE FROM ingreso_venta");
        jdbcTemplate.update("DELETE FROM detalle_venta");
        jdbcTemplate.update("DELETE FROM venta");
        jdbcTemplate.update("DELETE FROM turno_caja");
        jdbcTemplate.update("DELETE FROM caja");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre = 'Almacen Historial'");
        jdbcTemplate.update("DELETE FROM cliente WHERE nombre_completo = 'Maria Historica'");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.hist.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.hist.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_HIST'");
    }

    // ── Paginación y orden ────────────────────────────────────────────────

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("pagina en orden descendente estable por idVenta")
    void paginaEnOrdenDescendente() throws Exception {
        mockMvc.perform(get("/api/ventas").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-004"))
                .andExpect(jsonPath("$.content[1].numeroControl").value("VT-HIST-003"));

        mockMvc.perform(get("/api/ventas").param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-002"))
                .andExpect(jsonPath("$.content[1].numeroControl").value("VT-HIST-001"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("cada fila del resumen trae lo que la tabla muestra")
    void elResumenTraeLosCamposDeLaTabla() throws Exception {
        mockMvc.perform(get("/api/ventas").param("q", "VT-HIST-004"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].ncf").value("B0100000009"))
                .andExpect(jsonPath("$.content[0].tipoNcf").value("B01"))
                .andExpect(jsonPath("$.content[0].clienteNombre").value("Maria Historica"))
                .andExpect(jsonPath("$.content[0].cajeroNombre").value(CAJERO_BETO))
                .andExpect(jsonPath("$.content[0].metodoPagoPrincipal").value("EFECTIVO"))
                .andExpect(jsonPath("$.content[0].total").value(400.00))
                .andExpect(jsonPath("$.content[0].estado").value("COMPLETADA"));
    }

    // ── Búsqueda libre ────────────────────────────────────────────────────

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("busca por número de control")
    void buscaPorNumeroDeControl() throws Exception {
        mockMvc.perform(get("/api/ventas").param("q", "VT-HIST-002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-002"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("busca por NCF")
    void buscaPorNcf() throws Exception {
        mockMvc.perform(get("/api/ventas").param("q", "B0200000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-001"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("busca por cliente registrado y por cliente de paso")
    void buscaPorNombreDeCliente() throws Exception {
        mockMvc.perform(get("/api/ventas").param("q", "maria"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/ventas").param("q", "pasajero"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-002"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("un filtro vacío no filtra nada")
    void losFiltrosVaciosNoRecortan() throws Exception {
        mockMvc.perform(get("/api/ventas")
                        .param("q", "")
                        .param("cajero", "")
                        .param("metodoPago", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4));
    }

    // ── Filtros estructurados ─────────────────────────────────────────────

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("el rango de fechas incluye el día completo de fechaHasta")
    void elRangoDeFechasEsInclusivo() throws Exception {
        // La venta 002 ocurrió a las 23:45: un rango que trate fechaHasta como
        // medianoche la dejaría fuera.
        mockMvc.perform(get("/api/ventas")
                        .param("fechaDesde", "2026-01-15")
                        .param("fechaHasta", "2026-01-15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-002"));

        mockMvc.perform(get("/api/ventas")
                        .param("fechaDesde", "2026-01-10")
                        .param("fechaHasta", "2026-02-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("filtra por cajero")
    void filtraPorCajero() throws Exception {
        mockMvc.perform(get("/api/ventas").param("cajero", CAJERO_ANA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].cajeroNombre").value(CAJERO_ANA));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("filtra por método de pago")
    void filtraPorMetodoPago() throws Exception {
        mockMvc.perform(get("/api/ventas").param("metodoPago", "EFECTIVO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("los filtros se combinan entre sí")
    void losFiltrosSeCombinan() throws Exception {
        mockMvc.perform(get("/api/ventas")
                        .param("cajero", CAJERO_BETO)
                        .param("metodoPago", "EFECTIVO")
                        .param("fechaDesde", "2026-02-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroControl").value("VT-HIST-004"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("un rango invertido se rechaza con 400 y mensaje claro")
    void elRangoInvertidoSeRechaza() throws Exception {
        mockMvc.perform(get("/api/ventas")
                        .param("fechaDesde", "2026-02-01")
                        .param("fechaHasta", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value(org.hamcrest.Matchers.containsString("fechaDesde")));
    }

    // ── Detalle ───────────────────────────────────────────────────────────

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("el detalle por ID devuelve la venta persistida")
    void elDetalleDevuelveLaVentaPersistida() throws Exception {
        mockMvc.perform(get("/api/ventas/" + idVenta001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.numeroControl").value("VT-HIST-001"))
                .andExpect(jsonPath("$.ncf").value("B0200000001"))
                .andExpect(jsonPath("$.clienteNombre").value("Maria Historica"))
                .andExpect(jsonPath("$.almacenNombre").value("Almacen Historial"));
    }

    @Test
    @WithMockUser(authorities = "VENTA_VER")
    @DisplayName("una venta inexistente responde 404")
    void laVentaInexistenteResponde404() throws Exception {
        mockMvc.perform(get("/api/ventas/999999999"))
                .andExpect(status().isNotFound());
    }

    // ── Autorización ──────────────────────────────────────────────────────

    @Test
    @WithMockUser(authorities = "VENTA_CREAR")
    @DisplayName("crear ventas no da derecho a consultar el historial")
    void sinVentaVerNoSeConsultaElHistorial() throws Exception {
        mockMvc.perform(get("/api/ventas"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/ventas/" + idVenta001))
                .andExpect(status().isForbidden());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private Usuario crearUsuario(String username, Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setEmail(username + "@maxli.test");
        usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
        usuario.setEstado("ACTIVO");
        usuario.setRoles(Set.of(rol));
        return usuarioRepository.save(usuario);
    }

    private Venta nuevaVenta(TurnoCaja turno, Usuario usuario, Almacen almacen,
                             String numeroControl, String ncf, String tipoNcf,
                             MetodoPago metodoPago, BigDecimal total, LocalDateTime fecha) {
        Venta venta = new Venta();
        venta.setTurnoCaja(turno);
        venta.setUsuario(usuario);
        venta.setAlmacen(almacen);
        venta.setNumeroControl(numeroControl);
        venta.setNcf(ncf);
        venta.setTipoNcf(tipoNcf);
        venta.setMetodoPagoPrincipal(metodoPago);
        venta.setSubtotal(total);
        venta.setDescuentoTotal(BigDecimal.ZERO);
        venta.setItbis(BigDecimal.ZERO);
        venta.setTotal(total);
        venta.setEstado("COMPLETADA");
        venta.setFechaVenta(fecha);
        return venta;
    }
}
