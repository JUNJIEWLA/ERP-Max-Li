package com.maxli.venta.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.exception.BusinessException;
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
import com.maxli.venta.repository.VentaRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Reproduce ISSUE-007: con el mismo producto en dos almacenes, la venta
 * tomaba "la primera" existencia (menor {@code id_existencia}) en vez de la
 * del almacén real de la caja que cobra.
 * <p>
 * El almacén se deriva de {@code Caja.almacen}: cada caja registradora vive
 * en un almacén, y la venta hereda ese almacén de su turno abierto.
 */
@DisplayName("ISSUE-007 — La venta descuenta el almacén exacto de su caja")
class VentaAlmacenTest extends PostgresIntegrationTest {

    private static final BigDecimal PRECIO_VENTA = new BigDecimal("100.00");

    @Autowired private VentaService ventaService;
    @Autowired private VentaRepository ventaRepository;
    @Autowired private ExistenciaRepository existenciaRepository;
    @Autowired private ProductoRepository productoRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private MarcaRepository marcaRepository;
    @Autowired private AlmacenRepository almacenRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private RolRepository rolRepository;
    @Autowired private CajaRepository cajaRepository;
    @Autowired private TurnoCajaRepository turnoCajaRepository;
    @Autowired private ResolucionNcfRepository resolucionNcfRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idProducto;
    private Long idAlmacenA;
    private Long idAlmacenB;
    private Long idTurnoCaja;
    private Long idResolucionB02;
    private String username;

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_ALM_" + System.nanoTime());
            rol.setDescripcion("Rol de prueba de almacén de venta");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("cajero.alm." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);
            username = usuario.getUsername();

            Almacen almacenA = new Almacen();
            almacenA.setNombre("Almacen A " + System.nanoTime());
            almacenA.setEstado("ACTIVO");
            almacenA = almacenRepository.save(almacenA);
            idAlmacenA = almacenA.getIdAlmacen();

            Almacen almacenB = new Almacen();
            almacenB.setNombre("Almacen B " + System.nanoTime());
            almacenB.setEstado("ACTIVO");
            almacenB = almacenRepository.save(almacenB);
            idAlmacenB = almacenB.getIdAlmacen();

            // La caja vive en el almacén A: toda venta de este turno debe
            // descontar únicamente existencia de A, nunca de B.
            Caja caja = new Caja();
            caja.setNombre("Caja Almacen A " + System.nanoTime());
            caja.setEstado("ACTIVO");
            caja.setAlmacen(almacenA);
            caja = cajaRepository.save(caja);

            TurnoCaja turno = new TurnoCaja();
            turno.setCaja(caja);
            turno.setUsuarioApertura(usuario);
            turno.setMontoInicial(new BigDecimal("1000.00"));
            turno.setEstado("ABIERTO");
            turno.setFechaApertura(LocalDateTime.now());
            idTurnoCaja = turnoCajaRepository.save(turno).getIdTurnoCaja();

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria Alm " + System.nanoTime());
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Alm " + System.nanoTime());
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-ALM-" + System.nanoTime());
            producto.setNombre("Producto multi-almacen");
            producto.setPrecioVenta(PRECIO_VENTA);
            producto.setCosto(new BigDecimal("50.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            idProducto = productoRepository.save(producto).getIdProducto();

            idResolucionB02 = crearResolucion("B02", "Consumo").getIdResolucion();
        });
    }

    @AfterEach
    void limpiarEscenario() {
        jdbcTemplate.update("DELETE FROM detalle_movimiento");
        jdbcTemplate.update("DELETE FROM movimiento");
        jdbcTemplate.update("DELETE FROM ingreso_venta");
        jdbcTemplate.update("DELETE FROM detalle_venta");
        jdbcTemplate.update("DELETE FROM venta");
        jdbcTemplate.update("DELETE FROM turno_caja");
        jdbcTemplate.update("DELETE FROM caja");
        jdbcTemplate.update("DELETE FROM existencia");
        jdbcTemplate.update("DELETE FROM producto");
        jdbcTemplate.update("DELETE FROM categoria");
        jdbcTemplate.update("DELETE FROM marca");
        jdbcTemplate.update("DELETE FROM almacen");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.alm.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.alm.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CAJERO_ALM_%'");
    }

    @Test
    @DisplayName("con el producto en dos almacenes, la venta descuenta únicamente el del almacén de la caja")
    void ventaDescuentaUnicamenteElAlmacenDeLaCaja() {
        sembrarExistencia(idAlmacenA, 5);
        sembrarExistencia(idAlmacenB, 20);

        VentaResponseDTO venta = ventaService.procesarVenta(construirRequest(3), username);

        assertThat(venta.getIdAlmacen()).isEqualTo(idAlmacenA);
        assertThat(venta.getCajaNombre()).isNotNull();

        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenA)
                .orElseThrow().getCantidadActual())
                .as("el almacén de la caja bajó exactamente lo vendido")
                .isEqualTo(2);
        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenB)
                .orElseThrow().getCantidadActual())
                .as("el otro almacén no debe tocarse")
                .isEqualTo(20);
    }

    @Test
    @DisplayName("si el almacén de la caja está inactivo, la venta se rechaza aunque tenga stock")
    void ventaFallaSiElAlmacenDeLaCajaEstaInactivo() {
        sembrarExistencia(idAlmacenA, 10);
        desactivarAlmacen(idAlmacenA);

        assertThatThrownBy(() -> ventaService.procesarVenta(construirRequest(1), username))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inactivo");

        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenA)
                .orElseThrow().getCantidadActual())
                .as("con el almacén inactivo, no se toca la existencia")
                .isEqualTo(10);
        assertThat(ventaRepository.count())
                .as("no se persistió ninguna venta")
                .isZero();
    }

    @Test
    @DisplayName("si el almacén de la caja no tiene existencia, la venta falla aunque otro almacén sí tenga stock")
    void ventaFallaSiElAlmacenDeLaCajaNoTieneStockAunqueOtroSiTenga() {
        // Solo B tiene existencia del producto; A (el de la caja) no tiene fila.
        sembrarExistencia(idAlmacenB, 50);

        assertThatThrownBy(() -> ventaService.procesarVenta(construirRequest(1), username))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("No hay existencia registrada");

        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenB)
                .orElseThrow().getCantidadActual())
                .as("el almacén con stock que no corresponde a la caja queda intacto")
                .isEqualTo(50);
    }

    @Test
    @DisplayName("una venta rechazada por almacén no consume NCF ni deja cambios parciales")
    void ventaNoConsumeNcfNiDejaCambiosParcialesSiFallaPorAlmacen() {
        sembrarExistencia(idAlmacenB, 50);

        assertThatThrownBy(() -> ventaService.procesarVenta(construirRequest(1), username))
                .isInstanceOf(BusinessException.class);

        assertThat(secuenciaActual(idResolucionB02))
                .as("la resolución NCF no avanzó")
                .isEqualTo(1L);
        assertThat(ventaRepository.count())
                .as("no se persistió ninguna venta")
                .isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_venta", Long.class))
                .as("no quedan detalles huérfanos")
                .isZero();

        TurnoCaja turnoFinal = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turnoFinal.getTotalVentasEfectivo())
                .as("el cuadre del turno no se movió")
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("la venta concurrente del ISSUE-004 sigue protegida con el filtro de almacén explícito")
    void ventaConcurrenteSigueBloqueadaConAlmacenExplicito() throws Exception {
        sembrarExistencia(idAlmacenA, 9);
        sembrarExistencia(idAlmacenB, 9);

        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        Callable<VentaResponseDTO> venta1 = ventaConcurrente(salidaSimultanea);
        Callable<VentaResponseDTO> venta2 = ventaConcurrente(salidaSimultanea);

        List<Future<VentaResponseDTO>> resultados;
        try {
            resultados = pool.invokeAll(List.of(venta1, venta2));
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        int exitosas = 0;
        int fallidasPorStock = 0;
        for (Future<VentaResponseDTO> resultado : resultados) {
            try {
                resultado.get();
                exitosas++;
            } catch (ExecutionException e) {
                assertThat(e.getCause())
                        .isInstanceOf(BusinessException.class)
                        .hasMessageContaining("Stock insuficiente");
                fallidasPorStock++;
            }
        }

        assertThat(exitosas).as("exactamente una venta debe confirmarse").isEqualTo(1);
        assertThat(fallidasPorStock).as("la otra debe fallar por stock, no sobrevender").isEqualTo(1);

        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenA)
                .orElseThrow().getCantidadActual())
                .as("el almacén de la caja queda en 0, nunca negativo")
                .isZero();
        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenB)
                .orElseThrow().getCantidadActual())
                .as("el almacén B, ajeno a la caja, no debe tocarse")
                .isEqualTo(9);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void sembrarExistencia(Long idAlmacen, int cantidad) {
        transactionTemplate.executeWithoutResult(status -> {
            Existencia existencia = new Existencia();
            existencia.setProducto(productoRepository.findById(idProducto).orElseThrow());
            existencia.setAlmacen(almacenRepository.findById(idAlmacen).orElseThrow());
            existencia.setCantidadActual(cantidad);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);
        });
    }

    private void desactivarAlmacen(Long idAlmacen) {
        transactionTemplate.executeWithoutResult(status -> {
            Almacen almacen = almacenRepository.findById(idAlmacen).orElseThrow();
            almacen.setEstado("INACTIVO");
            almacenRepository.save(almacen);
        });
    }

    private Callable<VentaResponseDTO> ventaConcurrente(CyclicBarrier barrera) {
        return () -> {
            barrera.await(20, TimeUnit.SECONDS);
            return ventaService.procesarVenta(construirRequest(9), username);
        };
    }

    private CrearVentaRequestDTO construirRequest(int cantidad) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(PRECIO_VENTA.multiply(BigDecimal.valueOf(cantidad)));

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return request;
    }

    private ResolucionNcf crearResolucion(String tipo, String descripcion) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion(descripcion);
        resolucion.setNumeroResolucion("RES-ALM-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        return resolucionNcfRepository.save(resolucion);
    }

    private Long secuenciaActual(Long idResolucion) {
        return jdbcTemplate.queryForObject(
                "SELECT secuencia_actual FROM resolucion_ncf WHERE id_resolucion = ?",
                Long.class, idResolucion);
    }
}
