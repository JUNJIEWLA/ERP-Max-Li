package com.maxli.venta.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.compra.entity.DetalleNotaRecepcion;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.NotaRecepcion;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.entity.Proveedor;
import com.maxli.compra.repository.DetalleNotaRecepcionRepository;
import com.maxli.compra.repository.DetalleOrdenCompraRepository;
import com.maxli.compra.repository.NotaRecepcionRepository;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.compra.repository.ProveedorRepository;
import com.maxli.compra.service.NotaRecepcionService;
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

/**
 * Reproduce ISSUE-004: con 9 unidades en existencia, dos ventas simultáneas de
 * 9 unidades (una B01 y otra B02) confirmaban las dos y dejaban el inventario
 * sobrevendido.
 * <p>
 * Es una prueba de concurrencia real: dos hilos, dos transacciones, un
 * PostgreSQL de verdad. No hay mocks — el bug vive en la interacción entre
 * transacciones, así que simularla no probaría nada.
 */
@DisplayName("ISSUE-004 — Sobreventa concurrente en el POS")
class VentaConcurrenciaTest extends PostgresIntegrationTest {

    private static final int STOCK_INICIAL = 9;
    private static final int CANTIDAD_SOLICITADA = 9;
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
    @Autowired private NotaRecepcionService notaRecepcionService;
    @Autowired private NotaRecepcionRepository notaRecepcionRepository;
    @Autowired private DetalleNotaRecepcionRepository detalleNotaRecepcionRepository;
    @Autowired private OrdenCompraRepository ordenCompraRepository;
    @Autowired private DetalleOrdenCompraRepository detalleOrdenCompraRepository;
    @Autowired private ProveedorRepository proveedorRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idProducto;
    private Long idTurnoCaja;
    private Long idResolucionB01;
    private Long idResolucionB02;
    private Long idNotaRecepcion;
    private String username;

    /**
     * Siembra el escenario del auditor en una transacción que <b>commitea</b>:
     * los dos hilos de la prueba corren en transacciones propias y no verían
     * datos sin confirmar.
     */
    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_IT_" + System.nanoTime());
            rol.setDescripcion("Rol de prueba de concurrencia");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("cajero.it." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);
            username = usuario.getUsername();

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen IT " + System.nanoTime());
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja IT " + System.nanoTime());
            caja.setEstado("ACTIVO");
            caja.setAlmacen(almacen);
            caja = cajaRepository.save(caja);

            TurnoCaja turno = new TurnoCaja();
            turno.setCaja(caja);
            turno.setUsuarioApertura(usuario);
            turno.setMontoInicial(new BigDecimal("1000.00"));
            turno.setEstado("ABIERTO");
            turno.setFechaApertura(LocalDateTime.now());
            idTurnoCaja = turnoCajaRepository.save(turno).getIdTurnoCaja();

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria IT " + System.nanoTime());
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca IT " + System.nanoTime());
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-IT-" + System.nanoTime());
            producto.setNombre("Producto sobreventa");
            producto.setPrecioVenta(PRECIO_VENTA);
            producto.setCosto(new BigDecimal("50.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            idProducto = productoRepository.save(producto).getIdProducto();

            Existencia existencia = new Existencia();
            existencia.setProducto(producto);
            existencia.setAlmacen(almacen);
            existencia.setCantidadActual(STOCK_INICIAL);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            // Dos resoluciones activas: el bloqueo de NCF no serializa entre tipos
            // distintos, que es justamente lo que destapó el hallazgo.
            idResolucionB01 = crearResolucion("B01", "Crédito Fiscal").getIdResolucion();
            idResolucionB02 = crearResolucion("B02", "Consumo").getIdResolucion();

            Proveedor proveedor = new Proveedor();
            proveedor.setNombreEmpresa("Proveedor IT " + System.nanoTime());
            proveedor.setRnc("IT-" + System.nanoTime());
            proveedor.setEstado("ACTIVO");
            proveedor = proveedorRepository.save(proveedor);

            OrdenCompra orden = new OrdenCompra();
            orden.setProveedor(proveedor);
            orden.setEstado("ENVIADA");
            orden.setTotal(new BigDecimal("250.00"));
            orden = ordenCompraRepository.save(orden);

            DetalleOrdenCompra detalleOrden = new DetalleOrdenCompra();
            detalleOrden.setOrdenCompra(orden);
            detalleOrden.setProducto(producto);
            detalleOrden.setAlmacen(almacen);
            detalleOrden.setCantidad(5);
            detalleOrden.setCantidadRecibida(0);
            detalleOrden.setPrecioUnitario(new BigDecimal("50.00"));
            detalleOrden.setSubtotal(new BigDecimal("250.00"));
            detalleOrden = detalleOrdenCompraRepository.save(detalleOrden);

            NotaRecepcion nota = new NotaRecepcion();
            nota.setOrdenCompra(orden);
            nota.setEstado("PENDIENTE");
            nota = notaRecepcionRepository.save(nota);

            DetalleNotaRecepcion detalleNota = new DetalleNotaRecepcion();
            detalleNota.setNotaRecepcion(nota);
            detalleNota.setDetalleOrdenCompra(detalleOrden);
            detalleNota.setAlmacen(almacen);
            detalleNota.setCantidadRecibida(5);
            detalleNota.setObservacion("CONFORME");
            detalleNotaRecepcionRepository.save(detalleNota);
            idNotaRecepcion = nota.getIdNotaRecepcion();
        });
    }

    @AfterEach
    void limpiarEscenario() {
        jdbcTemplate.update("DELETE FROM alerta_costo");
        jdbcTemplate.update("DELETE FROM historial_costo");
        jdbcTemplate.update("DELETE FROM detalle_nota_recepcion");
        jdbcTemplate.update("DELETE FROM nota_recepcion");
        jdbcTemplate.update("DELETE FROM detalle_orden_compra");
        jdbcTemplate.update("DELETE FROM orden_compra");
        jdbcTemplate.update("DELETE FROM proveedor");
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
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.it.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.it.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CAJERO_IT_%'");
    }

    @Test
    @DisplayName("con stock 9, dos ventas simultáneas de 9 unidades: solo una confirma")
    void dosVentasSimultaneasNoPuedenSobrevenderElMismoStock() throws Exception {
        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        Callable<VentaResponseDTO> ventaB01 = ventaConcurrente(salidaSimultanea, "B01");
        Callable<VentaResponseDTO> ventaB02 = ventaConcurrente(salidaSimultanea, "B02");

        List<Future<VentaResponseDTO>> resultados;
        try {
            resultados = pool.invokeAll(List.of(ventaB01, ventaB02));
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        List<VentaResponseDTO> exitosas = new ArrayList<>();
        List<Throwable> fallidas = new ArrayList<>();
        for (Future<VentaResponseDTO> resultado : resultados) {
            try {
                exitosas.add(resultado.get());
            } catch (java.util.concurrent.ExecutionException e) {
                fallidas.add(e.getCause());
            }
        }

        // 1 y 2. Una venta confirma; la otra falla con un error de negocio,
        //        no con una violación de integridad ni un fallo de infraestructura.
        assertThat(exitosas)
                .as("exactamente una venta debe confirmarse")
                .hasSize(1);
        assertThat(fallidas)
                .as("la otra venta debe fallar con BusinessException controlada")
                .hasSize(1)
                .allSatisfy(error -> assertThat(error)
                        .isInstanceOf(BusinessException.class)
                        .hasMessageContaining("Stock insuficiente"));

        // 3. El stock final es correcto y nunca negativo.
        Existencia existenciaFinal = existenciaRepository
                .findFirstByProducto_IdProducto(idProducto)
                .orElseThrow();
        assertThat(existenciaFinal.getCantidadActual())
                .as("stock final = 9 - 9")
                .isZero();

        // 4. Solo se persistió una venta, con su único detalle.
        assertThat(ventaRepository.count())
                .as("solo una venta persistida")
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_venta", Long.class))
                .as("sin detalles huérfanos de la venta rechazada")
                .isEqualTo(1);

        // 5. Solo se consumió un NCF: la resolución perdedora queda intacta.
        VentaResponseDTO ventaConfirmada = exitosas.get(0);
        Long idResolucionGanadora = "B01".equals(ventaConfirmada.getTipoNcf()) ? idResolucionB01 : idResolucionB02;
        Long idResolucionPerdedora = "B01".equals(ventaConfirmada.getTipoNcf()) ? idResolucionB02 : idResolucionB01;

        assertThat(secuenciaActual(idResolucionGanadora))
                .as("la resolución usada avanza exactamente un comprobante")
                .isEqualTo(2L);
        assertThat(secuenciaActual(idResolucionPerdedora))
                .as("la resolución de la venta rechazada no consume NCF")
                .isEqualTo(1L);
        assertThat(ventaConfirmada.getNcf()).isNotBlank();

        // 6. La caja refleja una sola venta.
        TurnoCaja turnoFinal = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turnoFinal.getTotalVentasEfectivo())
                .as("el cuadre del turno contiene una sola venta")
                .isEqualByComparingTo(ventaConfirmada.getTotal());
    }

    @Test
    @DisplayName("venta y recepción simultáneas conservan ambos movimientos del mismo almacén")
    void ventaYRecepcionSimultaneasNoPierdenActualizaciones() throws Exception {
        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<VentaResponseDTO> venta = pool.submit(ventaConcurrente(salidaSimultanea, "B01"));
            Future<?> recepcion = pool.submit(() -> {
                salidaSimultanea.await(20, TimeUnit.SECONDS);
                return notaRecepcionService.confirmar(idNotaRecepcion);
            });

            venta.get(30, TimeUnit.SECONDS);
            recepcion.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        Existencia existenciaFinal = existenciaRepository.findFirstByProducto_IdProducto(idProducto).orElseThrow();
        assertThat(existenciaFinal.getCantidadActual()).isEqualTo(5);
    }

    @Test
    @DisplayName("dos confirmaciones simultáneas de una recepción solo incrementan una vez")
    void dobleConfirmacionConcurrenteDeRecepcionSoloSeAplicaUnaVez() throws Exception {
        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<? extends Future<?>> resultados;
        try {
            resultados = pool.invokeAll(List.of(
                    () -> { salidaSimultanea.await(20, TimeUnit.SECONDS); return notaRecepcionService.confirmar(idNotaRecepcion); },
                    () -> { salidaSimultanea.await(20, TimeUnit.SECONDS); return notaRecepcionService.confirmar(idNotaRecepcion); }));
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        int exitosas = 0;
        int fallidas = 0;
        for (Future<?> resultado : resultados) {
            try {
                resultado.get();
                exitosas++;
            } catch (java.util.concurrent.ExecutionException error) {
                assertThat(error.getCause()).isInstanceOf(BusinessException.class)
                        .hasMessageContaining("PENDIENTE");
                fallidas++;
            }
        }
        assertThat(exitosas).isEqualTo(1);
        assertThat(fallidas).isEqualTo(1);
        assertThat(existenciaRepository.findFirstByProducto_IdProducto(idProducto).orElseThrow().getCantidadActual())
                .isEqualTo(STOCK_INICIAL + 5);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Callable<VentaResponseDTO> ventaConcurrente(CyclicBarrier barrera, String tipoNcf) {
        return () -> {
            barrera.await(20, TimeUnit.SECONDS);
            return ventaService.procesarVenta(construirRequest(tipoNcf), username);
        };
    }

    private CrearVentaRequestDTO construirRequest(String tipoNcf) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(CANTIDAD_SOLICITADA);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(PRECIO_VENTA.multiply(BigDecimal.valueOf(CANTIDAD_SOLICITADA)));

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf(tipoNcf);
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return request;
    }

    private ResolucionNcf crearResolucion(String tipo, String descripcion) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion(descripcion);
        resolucion.setNumeroResolucion("RES-IT-" + tipo);
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
