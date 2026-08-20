package com.maxli.venta;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.ncf.entity.ResolucionNcf;
import com.maxli.ncf.repository.ResolucionNcfRepository;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.CategoriaRepository;
import com.maxli.producto.repository.MarcaRepository;
import com.maxli.producto.repository.ProductoRepository;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.repository.RolRepository;
import com.maxli.support.PostgresIntegrationTest;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.venta.dto.CrearVentaRequestDTO;
import com.maxli.venta.dto.DetalleVentaRequestDTO;
import com.maxli.venta.dto.IngresoVentaRequestDTO;
import com.maxli.venta.dto.VentaResponseDTO;
import com.maxli.venta.service.VentaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reporte de ventas: lo vendido de verdad, no lo facturado en bruto.
 * <p>
 * Una venta devuelta sigue siendo un hecho fiscal —se emitió su NCF y por eso
 * nunca desaparece del listado—, pero su Nota de Crédito B04 la revierte. El
 * total del reporte tiene que reflejar esa reversión; si no, el reporte cobra
 * dos veces lo que la tienda devolvió.
 * <p>
 * Se prueba contra PostgreSQL real y por el endpoint HTTP porque lo que se
 * valida es la suma que ve el usuario, no un cálculo aislado.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Reporte de ventas — neto de devoluciones")
class ReporteVentasNetoTest extends PostgresIntegrationTest {

    private static final String CAJERO = "cajero.reporte";
    private static final BigDecimal MONTO_INICIAL = new BigDecimal("1000.00");

    @Autowired private MockMvc mockMvc;
    @Autowired private VentaService ventaService;
    @Autowired private ProductoRepository productoRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private MarcaRepository marcaRepository;
    @Autowired private ExistenciaRepository existenciaRepository;
    @Autowired private AlmacenRepository almacenRepository;
    @Autowired private CajaRepository cajaRepository;
    @Autowired private TurnoCajaRepository turnoCajaRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private RolRepository rolRepository;
    @Autowired private ResolucionNcfRepository resolucionNcfRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idTurnoCaja;
    private Long idProductoGravado;   // 118.00 con ITBIS 18 % → base 100.00 + 18.00

    // ── Escenario ────────────────────────────────────────────────────────

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_REPORTE");
            rol.setDescripcion("Rol de prueba del reporte de ventas");
            rol = rolRepository.save(rol);

            Usuario cajero = new Usuario();
            cajero.setUsername(CAJERO);
            cajero.setEmail(CAJERO + "@maxli.test");
            cajero.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            cajero.setEstado("ACTIVO");
            cajero.setRoles(Set.of(rol));
            cajero = usuarioRepository.save(cajero);

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Reporte");
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja Reporte");
            caja.setEstado("ACTIVO");
            caja.setAlmacen(almacen);
            caja = cajaRepository.save(caja);

            TurnoCaja turno = new TurnoCaja();
            turno.setCaja(caja);
            turno.setUsuarioApertura(cajero);
            turno.setMontoInicial(MONTO_INICIAL);
            turno.setMontoEsperado(MONTO_INICIAL);
            turno.setEstado("ABIERTO");
            turno.setFechaApertura(LocalDateTime.now());
            idTurnoCaja = turnoCajaRepository.save(turno).getIdTurnoCaja();

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria Reporte");
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Reporte");
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-REP-GRAVADO");
            producto.setNombre("Producto gravado del reporte");
            producto.setPrecioVenta(new BigDecimal("118.00"));
            producto.setCosto(new BigDecimal("59.00"));
            producto.setTasaItbis(new BigDecimal("18.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            producto = productoRepository.save(producto);
            idProductoGravado = producto.getIdProducto();

            Existencia existencia = new Existencia();
            existencia.setProducto(producto);
            existencia.setAlmacen(almacen);
            existencia.setCantidadActual(100);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            crearResolucion("B02");
            crearResolucion("B04");
        });
    }

    @AfterEach
    void limpiarEscenario() {
        jdbcTemplate.update("DELETE FROM detalle_devolucion");
        jdbcTemplate.update("DELETE FROM devolucion");
        jdbcTemplate.update("DELETE FROM detalle_movimiento");
        jdbcTemplate.update("DELETE FROM movimiento");
        jdbcTemplate.update("DELETE FROM ingreso_venta");
        jdbcTemplate.update("DELETE FROM detalle_venta");
        jdbcTemplate.update("DELETE FROM venta");
        jdbcTemplate.update("DELETE FROM turno_caja");
        jdbcTemplate.update("DELETE FROM caja");
        jdbcTemplate.update("DELETE FROM existencia");
        jdbcTemplate.update("DELETE FROM producto WHERE sku = 'SKU-REP-GRAVADO'");
        jdbcTemplate.update("DELETE FROM categoria WHERE nombre = 'Categoria Reporte'");
        jdbcTemplate.update("DELETE FROM marca WHERE nombre = 'Marca Reporte'");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre = 'Almacen Reporte'");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username = '" + CAJERO + "')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username = '" + CAJERO + "'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_REPORTE'");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  1. El total no cuenta lo que ya se devolvió
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"VENTA_VER", "DEVOLUCION_CREAR"})
    @DisplayName("las devoluciones se restan del total: bruto − notas de crédito = neto")
    void elTotalRestaLasNotasDeCredito() throws Exception {
        // Venta intacta: 2 × 118.00 = 236.00 (base 200.00 + ITBIS 36.00)
        vender(2);

        // Venta devuelta por completo: 1 × 118.00, acreditada entera
        VentaResponseDTO devueltaEntera = vender(1);
        devolver(devueltaEntera, 1, "REP-REF-COMPLETA");

        // Venta devuelta a medias: 2 × 118.00, se acredita 1 unidad (118.00)
        VentaResponseDTO devueltaAMedias = vender(2);
        devolver(devueltaAMedias, 1, "REP-REF-PARCIAL");

        mockMvc.perform(get("/api/reportes/ventas").param("desde", hoy()).param("hasta", hoy()))
                .andExpect(status().isOk())
                // Bruto: las tres ventas tal como se facturaron
                .andExpect(jsonPath("$.totalVentasBrutas").value(590.00))
                .andExpect(jsonPath("$.totalItbisBrutos").value(90.00))
                .andExpect(jsonPath("$.totalTransacciones").value(3))
                // Acreditado: las dos notas de crédito B04
                .andExpect(jsonPath("$.totalNotasCredito").value(236.00))
                .andExpect(jsonPath("$.totalItbisNotasCredito").value(36.00))
                .andExpect(jsonPath("$.totalDevoluciones").value(2))
                // Neto: lo que la tienda se quedó de verdad
                .andExpect(jsonPath("$.totalVentas").value(354.00))
                .andExpect(jsonPath("$.totalItbis").value(54.00));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  2. Sin devoluciones, el neto es el bruto
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"VENTA_VER"})
    @DisplayName("sin devoluciones el neto coincide con el bruto y no se resta nada")
    void sinDevolucionesElNetoEsElBruto() throws Exception {
        vender(2);

        mockMvc.perform(get("/api/reportes/ventas").param("desde", hoy()).param("hasta", hoy()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVentasBrutas").value(236.00))
                .andExpect(jsonPath("$.totalVentas").value(236.00))
                .andExpect(jsonPath("$.totalNotasCredito").value(0))
                .andExpect(jsonPath("$.totalItbisNotasCredito").value(0))
                .andExpect(jsonPath("$.totalDevoluciones").value(0));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  3. ITBIS y descuentos reales, no ceros de relleno
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"VENTA_VER"})
    @DisplayName("el ITBIS y los descuentos salen de la venta persistida, no vienen en cero")
    void informaItbisYDescuentosReales() throws Exception {
        // 2 × 118.00 con RD$10.00 de descuento global sobre el total
        vender(2, new BigDecimal("10.00"), new BigDecimal("226.00"));

        BigDecimal itbisEnBaseDeDatos = jdbcTemplate.queryForObject(
                "SELECT SUM(itbis) FROM venta", BigDecimal.class);

        mockMvc.perform(get("/api/reportes/ventas").param("desde", hoy()).param("hasta", hoy()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalDescuentos").value(10.00))
                .andExpect(jsonPath("$.totalItbis").value(itbisEnBaseDeDatos.doubleValue()));

        assertThat(itbisEnBaseDeDatos).isGreaterThan(BigDecimal.ZERO);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  4. La venta devuelta sigue siendo visible
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"VENTA_VER", "DEVOLUCION_CREAR"})
    @DisplayName("la venta devuelta sigue apareciendo en el listado: el NCF emitido no se esconde")
    void laVentaDevueltaSigueEnElListado() throws Exception {
        VentaResponseDTO venta = vender(1);
        devolver(venta, 1, "REP-REF-VISIBLE");

        mockMvc.perform(get("/api/reportes/ventas").param("desde", hoy()).param("hasta", hoy()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventas.length()").value(1))
                .andExpect(jsonPath("$.ventas[0].numeroControl").value(venta.getNumeroControl()))
                .andExpect(jsonPath("$.ventas[0].estado").value("DEVUELTA"))
                .andExpect(jsonPath("$.ventas[0].total").value(118.00));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  5. Las devoluciones de otro cajero no contaminan el reporte filtrado
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"VENTA_VER", "DEVOLUCION_CREAR"})
    @DisplayName("un filtro que deja fuera la venta deja fuera también su nota de crédito")
    void elFiltroArrastraLaNotaDeCredito() throws Exception {
        VentaResponseDTO venta = vender(1);
        devolver(venta, 1, "REP-REF-FILTRO");

        // Ningún cajero llamado así vendió nada: ni ventas ni notas de crédito.
        mockMvc.perform(get("/api/reportes/ventas")
                        .param("desde", hoy()).param("hasta", hoy())
                        .param("cajero", "cajero.que.no.existe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTransacciones").value(0))
                .andExpect(jsonPath("$.totalVentasBrutas").value(0))
                .andExpect(jsonPath("$.totalNotasCredito").value(0))
                .andExpect(jsonPath("$.totalVentas").value(0))
                .andExpect(jsonPath("$.totalItbis").value(0))
                .andExpect(jsonPath("$.totalDescuentos").value(0));
    }

    // ── Utilidades ───────────────────────────────────────────────────────

    private String hoy() {
        return LocalDate.now().toString();
    }

    private VentaResponseDTO vender(int cantidad) {
        return vender(cantidad, BigDecimal.ZERO,
                new BigDecimal("118.00").multiply(BigDecimal.valueOf(cantidad)));
    }

    private VentaResponseDTO vender(int cantidad, BigDecimal descuentoGlobal, BigDecimal montoPagado) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProductoGravado);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(montoPagado);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDescuentoGlobal(descuentoGlobal);
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return ventaService.procesarVenta(request, CAJERO);
    }

    private void devolver(VentaResponseDTO venta, int cantidad, String referencia) throws Exception {
        String cuerpo = """
                {"idVenta":%d,"idTurnoCaja":%d,"motivo":"Producto defectuoso",
                 "metodoReembolso":"NOTA_CREDITO","referenciaOperacion":"%s",
                 "detalles":[{"idDetalleVenta":%d,"cantidad":%d}]}
                """.formatted(venta.getIdVenta(), idTurnoCaja, referencia,
                venta.getDetalles().get(0).getIdDetalleVenta(), cantidad);

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo))
                .andExpect(status().isCreated());
    }

    private void crearResolucion(String tipo) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion " + tipo);
        resolucion.setNumeroResolucion("RES-REP-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        resolucionNcfRepository.save(resolucion);
    }
}
