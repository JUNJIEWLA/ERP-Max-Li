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
 * Dos devoluciones simultáneas sobre la misma venta.
 * <p>
 * Sin bloquear la venta, validar "lo devuelto hasta ahora" y persistir es un
 * check-then-act: las dos transacciones leen el mismo acumulado, ambas lo
 * consideran suficiente y la venta termina sobredevuelta, con stock inventado
 * y dos notas de crédito. Solo un PostgreSQL real reproduce la carrera.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Devoluciones — concurrencia sobre la misma venta")
class DevolucionConcurrenciaTest extends PostgresIntegrationTest {

    private static final String CAJERO = "cajero.dev.concurrencia";
    private static final int CANTIDAD_VENDIDA = 4;
    private static final int CANTIDAD_POR_DEVOLUCION = 3;

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
    private VentaResponseDTO venta;

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_DEV_CONC");
            rol.setDescripcion("Rol de prueba de concurrencia de devoluciones");
            rol = rolRepository.save(rol);

            Usuario cajero = new Usuario();
            cajero.setUsername(CAJERO);
            cajero.setEmail(CAJERO + "@maxli.test");
            cajero.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            cajero.setEstado("ACTIVO");
            cajero.setRoles(Set.of(rol));
            cajero = usuarioRepository.save(cajero);

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Dev Concurrencia");
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja Dev Concurrencia");
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
            idTurnoCaja = turnoCajaRepository.save(turno).getIdTurnoCaja();

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria Dev Concurrencia");
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Dev Concurrencia");
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-DEV-CONC");
            producto.setNombre("Producto devolución concurrente");
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
            existencia.setCantidadActual(10);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            crearResolucion("B02");
            crearResolucion("B04");
        });

        venta = venderCuatroUnidades();
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
        jdbcTemplate.update("DELETE FROM producto WHERE sku = 'SKU-DEV-CONC'");
        jdbcTemplate.update("DELETE FROM categoria WHERE nombre = 'Categoria Dev Concurrencia'");
        jdbcTemplate.update("DELETE FROM marca WHERE nombre = 'Marca Dev Concurrencia'");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre = 'Almacen Dev Concurrencia'");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username = '" + CAJERO + "')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username = '" + CAJERO + "'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_DEV_CONC'");
    }

    @Test
    @DisplayName("de 4 vendidas, dos devoluciones simultáneas de 3 no pueden devolver 6")
    void dosDevolucionesSimultaneasNoSobredevuelven() throws Exception {
        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        List<Future<Integer>> resultados;
        try {
            resultados = pool.invokeAll(List.of(
                    devolucionConcurrente(salidaSimultanea, "REF-CONC-A"),
                    devolucionConcurrente(salidaSimultanea, "REF-CONC-B")));
        } finally {
            pool.shutdown();
            pool.awaitTermination(60, TimeUnit.SECONDS);
        }

        List<Integer> estados = new ArrayList<>();
        for (Future<Integer> resultado : resultados) {
            estados.add(resultado.get());
        }

        assertThat(estados)
                .as("una devolución confirma y la otra se rechaza por regla de negocio")
                .containsExactlyInAnyOrder(201, 422);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(cantidad), 0) FROM detalle_devolucion", Integer.class))
                .as("nunca se devuelve más de lo vendido")
                .isEqualTo(CANTIDAD_POR_DEVOLUCION);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM devolucion", Long.class))
                .as("una sola nota de crédito")
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT ncf) FROM devolucion", Long.class))
                .as("sin B04 duplicado")
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT secuencia_actual FROM resolucion_ncf WHERE tipo_ncf = 'B04'", Long.class))
                .as("solo se consumió un comprobante B04")
                .isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT cantidad_actual FROM existencia WHERE id_producto = ?", Integer.class, idProducto))
                .as("stock = 10 - 4 vendidas + 3 devueltas")
                .isEqualTo(9);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT estado FROM venta WHERE id_venta = ?", String.class, venta.getIdVenta()))
                .isEqualTo("PARCIALMENTE_DEVUELTA");
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Callable<Integer> devolucionConcurrente(CyclicBarrier barrera, String referencia) {
        return () -> {
            barrera.await(30, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .with(user(CAJERO).authorities(
                                    new org.springframework.security.core.authority
                                            .SimpleGrantedAuthority("DEVOLUCION_CREAR")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"idVenta":%d,"idTurnoCaja":%d,"motivo":"Devolución concurrente",
                                     "metodoReembolso":"EFECTIVO","referenciaOperacion":"%s",
                                     "detalles":[{"idDetalleVenta":%d,"cantidad":%d}]}
                                    """.formatted(venta.getIdVenta(), idTurnoCaja, referencia,
                                    venta.getDetalles().get(0).getIdDetalleVenta(),
                                    CANTIDAD_POR_DEVOLUCION)))
                    .andReturn().getResponse().getStatus();
        };
    }

    private VentaResponseDTO venderCuatroUnidades() {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(CANTIDAD_VENDIDA);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(new BigDecimal("472.00"));

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
        resolucion.setNumeroResolucion("RES-CONC-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        resolucionNcfRepository.save(resolucion);
    }
}
