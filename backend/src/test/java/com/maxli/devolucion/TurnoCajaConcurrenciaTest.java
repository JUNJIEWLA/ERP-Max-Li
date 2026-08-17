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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
 * Escrituras concurrentes sobre el mismo turno de caja.
 * <p>
 * Venta, devolución y cierre leen el turno, recalculan el cuadre y lo vuelven a
 * guardar. Sin bloquear la fila, eso es un check-then-act con dos desenlaces
 * malos: una devolución que validó ABIERTO puede guardarse después de un cierre
 * confirmado —reabriendo el turno—, y una venta simultánea puede pisar el
 * {@code totalDevolucionesEfectivo} que la devolución acababa de escribir,
 * dejando el monto esperado por encima del efectivo real del cajón.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Turno de caja — escrituras concurrentes de venta, devolución y cierre")
class TurnoCajaConcurrenciaTest extends PostgresIntegrationTest {

    private static final String CAJERO = "cajero.turno.concurrencia";
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
    private Long idProducto;
    private VentaResponseDTO ventaPrevia;

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_TURNO_CONC");
            rol.setDescripcion("Rol de prueba de concurrencia sobre el turno");
            rol = rolRepository.save(rol);

            Usuario cajero = new Usuario();
            cajero.setUsername(CAJERO);
            cajero.setEmail(CAJERO + "@maxli.test");
            cajero.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            cajero.setEstado("ACTIVO");
            cajero.setRoles(Set.of(rol));
            cajero = usuarioRepository.save(cajero);

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Turno Concurrencia");
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja Turno Concurrencia");
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
            categoria.setNombre("Categoria Turno Concurrencia");
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Turno Concurrencia");
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-TURNO-CONC");
            producto.setNombre("Producto turno concurrente");
            producto.setPrecioVenta(new BigDecimal("118.00"));
            producto.setCosto(new BigDecimal("59.00"));
            producto.setTasaItbis(new BigDecimal("18.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            idProducto = productoRepository.save(producto).getIdProducto();

            Existencia existencia = new Existencia();
            existencia.setProducto(producto);
            existencia.setAlmacen(almacen);
            existencia.setCantidadActual(100);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            crearResolucion("B02");
            crearResolucion("B04");
        });

        // Venta base: 2 × 118.00 en efectivo. Turno esperado 1000 + 236 = 1236.
        ventaPrevia = vender(2, new BigDecimal("236.00"));
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
        jdbcTemplate.update("DELETE FROM producto WHERE sku = 'SKU-TURNO-CONC'");
        jdbcTemplate.update("DELETE FROM categoria WHERE nombre = 'Categoria Turno Concurrencia'");
        jdbcTemplate.update("DELETE FROM marca WHERE nombre = 'Marca Turno Concurrencia'");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre = 'Almacen Turno Concurrencia'");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username = '" + CAJERO + "')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username = '" + CAJERO + "'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_TURNO_CONC'");
    }

    @Test
    @DisplayName("una devolución simultánea a un cierre nunca reabre el turno")
    void devolucionYCierreSimultaneosNoReabrenElTurno() throws Exception {
        CyclicBarrier salida = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        List<Future<Integer>> resultados;
        try {
            resultados = pool.invokeAll(List.of(
                    devolucionConcurrente(salida, "REF-TURNO-CIERRE", 2),
                    cierreConcurrente(salida)));
        } finally {
            pool.shutdown();
            pool.awaitTermination(60, TimeUnit.SECONDS);
        }

        int estadoDevolucion = resultados.get(0).get();
        int estadoCierre = resultados.get(1).get();

        assertThat(estadoCierre).as("el cierre se confirma").isEqualTo(200);
        assertThat(estadoTurno())
                .as("un turno cerrado no vuelve a abrirse por una devolución que llegó tarde")
                .isEqualTo("CERRADO");

        if (estadoDevolucion == 201) {
            // La devolución ganó la carrera: el cierre la vio y cuadró con ella.
            assertThat(devoluciones()).isEqualTo(1);
            assertThat(devolucionesEfectivoTurno()).isEqualByComparingTo("236.00");
            assertThat(montoEsperadoTurno())
                    .as("1000 inicial + 236 vendidos - 236 devueltos")
                    .isEqualByComparingTo("1000.00");
            assertThat(stock()).isEqualTo(100);
        } else {
            // El cierre ganó: la devolución se rechaza por turno no abierto.
            assertThat(estadoDevolucion)
                    .as("sobre un turno cerrado, la devolución es una regla de negocio incumplida")
                    .isEqualTo(422);
            assertThat(devoluciones()).isZero();
            assertThat(devolucionesEfectivoTurno()).isEqualByComparingTo("0.00");
            assertThat(montoEsperadoTurno()).isEqualByComparingTo("1236.00");
            assertThat(stock()).isEqualTo(98);
        }
    }

    @Test
    @DisplayName("una venta simultánea a una devolución no pierde el efectivo devuelto")
    void ventaYDevolucionSimultaneasConservanAmbosAjustes() throws Exception {
        CyclicBarrier salida = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        try {
            Future<Integer> devolucion = pool.submit(
                    devolucionConcurrente(salida, "REF-TURNO-VENTA", 2));
            Future<VentaResponseDTO> venta = pool.submit(() -> {
                salida.await(30, TimeUnit.SECONDS);
                return vender(1, new BigDecimal("118.00"));
            });

            assertThat(devolucion.get(60, TimeUnit.SECONDS)).isEqualTo(201);
            venta.get(60, TimeUnit.SECONDS);
        } finally {
            pool.shutdown();
            pool.awaitTermination(60, TimeUnit.SECONDS);
        }

        assertThat(devolucionesEfectivoTurno())
                .as("la venta posterior no pisa el efectivo devuelto")
                .isEqualByComparingTo("236.00");
        assertThat(montoEsperadoTurno())
                .as("1000 inicial + 236 + 118 vendidos - 236 devueltos")
                .isEqualByComparingTo("1118.00");
        assertThat(stock()).as("100 - 2 vendidas + 2 devueltas - 1 vendida").isEqualTo(99);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Callable<Integer> devolucionConcurrente(CyclicBarrier barrera, String referencia, int cantidad) {
        return () -> {
            barrera.await(30, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .with(user(CAJERO).authorities(new SimpleGrantedAuthority("DEVOLUCION_CREAR")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"idVenta":%d,"idTurnoCaja":%d,"motivo":"Devolución concurrente",
                                     "metodoReembolso":"EFECTIVO","referenciaOperacion":"%s",
                                     "detalles":[{"idDetalleVenta":%d,"cantidad":%d}]}
                                    """.formatted(ventaPrevia.getIdVenta(), idTurnoCaja, referencia,
                                    ventaPrevia.getDetalles().get(0).getIdDetalleVenta(), cantidad)))
                    .andReturn().getResponse().getStatus();
        };
    }

    private Callable<Integer> cierreConcurrente(CyclicBarrier barrera) {
        return () -> {
            barrera.await(30, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/cajas/turnos/" + idTurnoCaja + "/cerrar").with(csrf())
                            .with(user(CAJERO).authorities(new SimpleGrantedAuthority("CAJA_OPERAR")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"montoFinalDeclarado":1000.00,"observacionCierre":"Cierre concurrente"}
                                    """))
                    .andReturn().getResponse().getStatus();
        };
    }

    private VentaResponseDTO vender(int cantidad, BigDecimal monto) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(monto);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return ventaService.procesarVenta(request, CAJERO);
    }

    private void crearResolucion(String tipo) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion " + tipo);
        resolucion.setNumeroResolucion("RES-TURNO-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        resolucionNcfRepository.save(resolucion);
    }

    private String estadoTurno() {
        return jdbcTemplate.queryForObject(
                "SELECT estado FROM turno_caja WHERE id_turno_caja = ?", String.class, idTurnoCaja);
    }

    private BigDecimal montoEsperadoTurno() {
        return jdbcTemplate.queryForObject(
                "SELECT monto_esperado FROM turno_caja WHERE id_turno_caja = ?", BigDecimal.class, idTurnoCaja);
    }

    private BigDecimal devolucionesEfectivoTurno() {
        return jdbcTemplate.queryForObject(
                "SELECT total_devoluciones_efectivo FROM turno_caja WHERE id_turno_caja = ?",
                BigDecimal.class, idTurnoCaja);
    }

    private long devoluciones() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM devolucion", Long.class);
    }

    private int stock() {
        return jdbcTemplate.queryForObject(
                "SELECT cantidad_actual FROM existencia WHERE id_producto = ?", Integer.class, idProducto);
    }
}
