package com.maxli.devolucion;

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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * La misma Nota de Crédito cobrada a la vez en dos cajas.
 * <p>
 * Leer el saldo disponible, restarle el importe y guardar es un check-then-act:
 * si nadie serializa las dos transacciones, ambas leen el mismo saldo, ambas lo
 * consideran suficiente y el cliente paga dos veces con un crédito que solo
 * alcanzaba para una. El dinero no aparece de la nada: lo pone la tienda.
 * <p>
 * La carrera necesita <b>dos turnos</b>. Una venta bloquea la fila de su turno
 * ({@code TurnoCajaRepository.bloquearPorId}), así que dos cobros sobre la misma
 * caja ya están serializados por ese lado y no reproducirían nada. Dos cajeros
 * en dos cajas —lo normal en la tienda— no comparten ese bloqueo.
 * <p>
 * Solo un PostgreSQL real reproduce la carrera.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Nota de Crédito — concurrencia al redimirla")
class NotaCreditoConcurrenciaTest extends PostgresIntegrationTest {

    /** Un usuario no puede tener dos turnos abiertos: una caja, un cajero. */
    private static final String CAJERO_UNO = "cajero.nc.concurrencia.uno";
    private static final String CAJERO_DOS = "cajero.nc.concurrencia.dos";
    /** Total de la venta que se devuelve: 2 × 118.00. Es el saldo de la B04. */
    private static final BigDecimal SALDO_NOTA_CREDITO = new BigDecimal("236.00");

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

    private Long idTurnoUno;
    private Long idTurnoDos;
    private Long idProductoUno;
    private Long idProductoDos;
    private String numeroNotaCredito;

    @BeforeEach
    void sembrarEscenario() throws Exception {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_NC_CONC");
            rol.setDescripcion("Rol de prueba de concurrencia de notas de crédito");
            rol = rolRepository.save(rol);

            Usuario cajeroUno = crearCajero(CAJERO_UNO, rol);
            Usuario cajeroDos = crearCajero(CAJERO_DOS, rol);

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria NC Concurrencia");
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca NC Concurrencia");
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            // Dos cajas, cada una con su almacén y su turno abierto: es la única
            // forma de que dos cobros simultáneos no se serialicen por el turno.
            idTurnoUno = abrirCaja("Uno", cajeroUno);
            idTurnoDos = abrirCaja("Dos", cajeroDos);
            idProductoUno = sembrarProducto("SKU-NC-CONC-1", categoria, marca, "Almacen NC Concurrencia Uno");
            idProductoDos = sembrarProducto("SKU-NC-CONC-2", categoria, marca, "Almacen NC Concurrencia Dos");

            // Cada caja factura con un tipo distinto —consumidor final y
            // crédito fiscal— para que el bloqueo de la secuencia NCF, que es
            // por fila de resolución, no serialice los dos cobros por su cuenta
            // y esconda la carrera que aquí se mide.
            crearResolucion("B01");
            crearResolucion("B02");
            crearResolucion("B04");
        });

        // Una venta de 236.00 devuelta entera deja una B04 con ese saldo vivo.
        VentaResponseDTO venta = vender(idTurnoUno, idProductoUno, 2, new BigDecimal("236.00"));
        numeroNotaCredito = devolverEntera(venta);
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
        jdbcTemplate.update("DELETE FROM producto WHERE sku LIKE 'SKU-NC-CONC-%'");
        jdbcTemplate.update("DELETE FROM categoria WHERE nombre = 'Categoria NC Concurrencia'");
        jdbcTemplate.update("DELETE FROM marca WHERE nombre = 'Marca NC Concurrencia'");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre LIKE 'Almacen NC Concurrencia%'");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.nc.concurrencia%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.nc.concurrencia%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_NC_CONC'");
    }

    @Test
    @DisplayName("una Nota de Crédito de 236.00 no paga dos ventas de 236.00 en cajas distintas")
    void dosCobrosSimultaneosNoGastanDosVecesElMismoSaldo() throws Exception {
        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        List<Future<Integer>> resultados;
        try {
            resultados = pool.invokeAll(List.of(
                    cobroConNotaCredito(salidaSimultanea, idTurnoUno, idProductoUno, CAJERO_UNO, "B01"),
                    cobroConNotaCredito(salidaSimultanea, idTurnoDos, idProductoDos, CAJERO_DOS, "B02")));
        } finally {
            pool.shutdown();
            pool.awaitTermination(60, TimeUnit.SECONDS);
        }

        List<Integer> estados = new ArrayList<>();
        for (Future<Integer> resultado : resultados) {
            estados.add(resultado.get());
        }

        assertThat(estados)
                .as("un cobro consume el saldo y el otro se queda sin fondos")
                .containsExactlyInAnyOrder(201, 422);

        assertThat(saldoUsado())
                .as("no se puede gastar más crédito del que la nota acreditó")
                .isEqualByComparingTo(SALDO_NOTA_CREDITO);
        assertThat(saldoDisponible())
                .as("el saldo queda agotado, nunca en negativo")
                .isEqualByComparingTo("0.00");
        assertThat(ventasCobradasConNotaCredito())
                .as("una sola venta se cobró contra la nota")
                .isEqualTo(1);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Callable<Integer> cobroConNotaCredito(
            CyclicBarrier barrera, Long idTurno, Long idProducto, String cajero, String tipoNcf) {
        return () -> {
            barrera.await(30, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/ventas").with(csrf())
                            .with(user(cajero).authorities(
                                    new org.springframework.security.core.authority
                                            .SimpleGrantedAuthority("VENTA_CREAR")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"idTurnoCaja":%d,"tipoNcf":"%s","metodoPago":"NOTA_CREDITO",
                                     "detalles":[{"idProducto":%d,"cantidad":2}],
                                     "ingresos":[{"metodoPago":"NOTA_CREDITO","monto":236.00,
                                                  "referencia":"%s"}]}
                                    """.formatted(idTurno, tipoNcf, idProducto, numeroNotaCredito)))
                    .andReturn().getResponse().getStatus();
        };
    }

    /** Devuelve entera la venta y responde con el número de la B04 emitida. */
    private String devolverEntera(VentaResponseDTO venta) throws Exception {
        String respuesta = mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .with(user(CAJERO_UNO).authorities(
                                new org.springframework.security.core.authority
                                        .SimpleGrantedAuthority("DEVOLUCION_CREAR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"idVenta":%d,"idTurnoCaja":%d,"motivo":"Producto defectuoso",
                                 "metodoReembolso":"NOTA_CREDITO","referenciaOperacion":"REF-NC-CONC",
                                 "detalles":[{"idDetalleVenta":%d,"cantidad":2}]}
                                """.formatted(venta.getIdVenta(), idTurnoUno,
                                venta.getDetalles().get(0).getIdDetalleVenta())))
                .andReturn().getResponse().getContentAsString();

        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("\"ncf\"\\s*:\\s*\"(B04[^\"]+)\"").matcher(respuesta);
        assertThat(matcher.find()).as("la devolución emitió una B04: %s", respuesta).isTrue();
        return matcher.group(1);
    }

    private VentaResponseDTO vender(Long idTurno, Long idProducto, int cantidad, BigDecimal monto) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(monto);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurno);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return ventaService.procesarVenta(request, CAJERO_UNO);
    }

    private Usuario crearCajero(String username, Rol rol) {
        Usuario cajero = new Usuario();
        cajero.setUsername(username);
        cajero.setEmail(username + "@maxli.test");
        cajero.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
        cajero.setEstado("ACTIVO");
        cajero.setRoles(Set.of(rol));
        return usuarioRepository.save(cajero);
    }

    private Long abrirCaja(String sufijo, Usuario cajero) {
        Almacen almacen = new Almacen();
        almacen.setNombre("Almacen NC Concurrencia " + sufijo);
        almacen.setEstado("ACTIVO");
        almacen = almacenRepository.save(almacen);

        Caja caja = new Caja();
        caja.setNombre("Caja NC Concurrencia " + sufijo);
        caja.setEstado("ACTIVO");
        caja.setAlmacen(almacen);
        caja = cajaRepository.save(caja);

        TurnoCaja turno = new TurnoCaja();
        turno.setCaja(caja);
        turno.setUsuarioApertura(cajero);
        turno.setMontoInicial(new BigDecimal("1000.00"));
        turno.setMontoEsperado(new BigDecimal("1000.00"));
        turno.setEstado("ABIERTO");
        turno.setFechaApertura(LocalDateTime.now());
        return turnoCajaRepository.save(turno).getIdTurnoCaja();
    }

    private Long sembrarProducto(String sku, Categoria categoria, Marca marca, String nombreAlmacen) {
        Producto producto = new Producto();
        producto.setSku(sku);
        producto.setNombre("Producto " + sku);
        producto.setPrecioVenta(new BigDecimal("118.00"));
        producto.setCosto(new BigDecimal("59.00"));
        producto.setTasaItbis(new BigDecimal("18.00"));
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        producto = productoRepository.save(producto);

        Existencia existencia = new Existencia();
        existencia.setProducto(producto);
        existencia.setAlmacen(almacenRepository.findAll().stream()
                .filter(a -> nombreAlmacen.equals(a.getNombre()))
                .findFirst()
                .orElseThrow());
        existencia.setCantidadActual(20);
        existencia.setCantidadMinima(0);
        existenciaRepository.save(existencia);

        return producto.getIdProducto();
    }

    private void crearResolucion(String tipo) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion " + tipo);
        resolucion.setNumeroResolucion("RES-NC-CONC-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        resolucionNcfRepository.save(resolucion);
    }

    private BigDecimal saldoUsado() {
        return jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(monto_usado), 0) FROM devolucion", BigDecimal.class);
    }

    private BigDecimal saldoDisponible() {
        return jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(monto_disponible), 0) FROM devolucion", BigDecimal.class);
    }

    private int ventasCobradasConNotaCredito() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ingreso_venta WHERE metodo_pago = 'NOTA_CREDITO'", Integer.class);
    }
}
