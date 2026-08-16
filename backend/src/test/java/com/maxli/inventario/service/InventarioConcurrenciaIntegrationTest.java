package com.maxli.inventario.service;

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
import com.maxli.conteo.dto.ConteoCreateRequestDTO;
import com.maxli.conteo.dto.ConteoDetalleRequestDTO;
import com.maxli.conteo.dto.ConteoDetallesBatchRequestDTO;
import com.maxli.conteo.entity.ConteoCabecera;
import com.maxli.conteo.repository.ConteoCabeceraRepository;
import com.maxli.conteo.service.ConteoService;
import com.maxli.exception.BusinessException;
import com.maxli.existencia.dto.AjusteExistenciaRequestDTO;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.existencia.service.ExistenciaLockService;
import com.maxli.existencia.service.ExistenciaLockService.ClaveExistencia;
import com.maxli.existencia.service.ExistenciaService;
import com.maxli.inventario.dto.DetalleMovimientoRequestDTO;
import com.maxli.inventario.dto.MovimientoRequestDTO;
import com.maxli.inventario.dto.MovimientoResponseDTO;
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
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

@DisplayName("ISSUE-004 — concurrencia restante de movimientos de inventario")
class InventarioConcurrenciaIntegrationTest extends PostgresIntegrationTest {

    private static final BigDecimal PRECIO_VENTA = new BigDecimal("100.00");

    @Autowired private AlmacenRepository almacenRepository;
    @Autowired private CajaRepository cajaRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private ConteoCabeceraRepository conteoCabeceraRepository;
    @Autowired private ConteoService conteoService;
    @Autowired private DetalleNotaRecepcionRepository detalleNotaRecepcionRepository;
    @Autowired private DetalleOrdenCompraRepository detalleOrdenCompraRepository;
    @Autowired private ExistenciaLockService existenciaLockService;
    @Autowired private ExistenciaRepository existenciaRepository;
    @Autowired private ExistenciaService existenciaService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private MarcaRepository marcaRepository;
    @Autowired private MovimientoService movimientoService;
    @Autowired private NotaRecepcionRepository notaRecepcionRepository;
    @Autowired private NotaRecepcionService notaRecepcionService;
    @Autowired private OrdenCompraRepository ordenCompraRepository;
    @Autowired private ProductoRepository productoRepository;
    @Autowired private ProveedorRepository proveedorRepository;
    @Autowired private ResolucionNcfRepository resolucionNcfRepository;
    @Autowired private RolRepository rolRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private TurnoCajaRepository turnoCajaRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private VentaService ventaService;

    @AfterEach
    void limpiarDatos() {
        jdbcTemplate.update("DELETE FROM alerta_costo");
        jdbcTemplate.update("DELETE FROM historial_costo");
        jdbcTemplate.update("DELETE FROM detalle_nota_recepcion");
        jdbcTemplate.update("DELETE FROM nota_recepcion");
        jdbcTemplate.update("DELETE FROM detalle_orden_compra");
        jdbcTemplate.update("DELETE FROM orden_compra");
        jdbcTemplate.update("DELETE FROM proveedor");
        jdbcTemplate.update("DELETE FROM detalle_movimiento");
        jdbcTemplate.update("DELETE FROM movimiento");
        jdbcTemplate.update("DELETE FROM conteo_detalle");
        jdbcTemplate.update("DELETE FROM conteo_cabecera");
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
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'concurrencia.it.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'concurrencia.it.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CONCURRENCIA_IT_%'");
    }

    @Test
    @DisplayName("venta contra aplicación de conteo conserva la venta y la diferencia")
    void ventaContraAplicacionDeConteoConservaAmbosCambios() throws Exception {
        EscenarioBase escenario = crearEscenarioBase(9);
        Long idConteo = crearConteoEnRevision(escenario, 12);

        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<VentaResponseDTO> venta = pool.submit(() -> {
                salidaSimultanea.await(20, TimeUnit.SECONDS);
                return ventaService.procesarVenta(ventaRequest(escenario.idTurnoCaja(), escenario.idProducto(), 9, "B02"),
                        escenario.username());
            });
            Future<?> conteo = pool.submit(() -> {
                salidaSimultanea.await(20, TimeUnit.SECONDS);
                return conteoService.aplicar(idConteo);
            });

            venta.get(30, TimeUnit.SECONDS);
            conteo.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA()))
                .as("saldo final = 9 - venta 9 + diferencia de conteo 3")
                .isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM venta", Long.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_venta", Long.class)).isEqualTo(1);
        assertThat(movimientosPorTipo("AJUSTE")).isEqualTo(1);
        assertThat(detallesMovimientoPorTipo("AJUSTE")).isEqualTo(1);
        assertThat(conteoCabeceraRepository.findById(idConteo).orElseThrow().getEstado()).isEqualTo("APLICADO");
    }

    @Test
    @DisplayName("transferencias inversas simultáneas terminan sin deadlock ni saldos negativos")
    void transferenciasInversasSimultaneasNoGeneranDeadlockNiParciales() throws Exception {
        EscenarioBase escenario = crearEscenarioBase(10);
        crearExistencia(escenario.idProducto(), escenario.idAlmacenB(), 7);

        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<MovimientoResponseDTO> aB = pool.submit(transferenciaConcurrente(
                    salidaSimultanea, escenario.idAlmacenA(), escenario.idAlmacenB(), escenario.idProducto(), 3));
            Future<MovimientoResponseDTO> bA = pool.submit(transferenciaConcurrente(
                    salidaSimultanea, escenario.idAlmacenB(), escenario.idAlmacenA(), escenario.idProducto(), 4));

            aB.get(30, TimeUnit.SECONDS);
            bA.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(11);
        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenB())).isEqualTo(6);
        assertThat(jdbcTemplate.queryForObject("SELECT MIN(cantidad_actual) FROM existencia", Integer.class))
                .isGreaterThanOrEqualTo(0);
        assertThat(movimientosPorTipo("TRANSFERENCIA")).isEqualTo(2);
        assertThat(detallesMovimientoPorTipo("TRANSFERENCIA")).isEqualTo(2);
    }

    @Test
    @DisplayName("dos recepciones simultáneas crean una sola existencia y suman ambas cantidades")
    void recepcionesConcurrentesCreanUnaSolaExistenciaInexistente() throws Exception {
        EscenarioBase escenario = crearEscenarioBaseSinExistencia();
        Long nota1 = crearNotaRecepcion(escenario.idProducto(), escenario.idAlmacenA(), 5, "55.00");
        Long nota2 = crearNotaRecepcion(escenario.idProducto(), escenario.idAlmacenA(), 7, "55.00");

        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> r1 = pool.submit(confirmacionConcurrente(salidaSimultanea, nota1));
            Future<?> r2 = pool.submit(confirmacionConcurrente(salidaSimultanea, nota2));
            r1.get(30, TimeUnit.SECONDS);
            r2.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        assertThat(filasExistencia(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(1);
        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(12);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nota_recepcion WHERE estado = 'CONFIRMADA'", Long.class))
                .isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_nota_recepcion", Long.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("transferencia multilínea fallida revierte existencias, cabecera y detalles")
    void rollbackCompletoDeTransferenciaMultilineaIncluyeDestinoCreadoConOnConflict() {
        EscenarioBase escenario = crearEscenarioBase(5);
        Long idProductoSinStock = crearProducto();
        crearExistencia(idProductoSinStock, escenario.idAlmacenA(), 1);

        MovimientoRequestDTO request = transferenciaRequest(
                escenario.idAlmacenA(), escenario.idAlmacenB(),
                Map.of(escenario.idProducto(), 3, idProductoSinStock, 5));

        try {
            movimientoService.crearTransferencia(request);
            fail("La transferencia debía fallar por stock insuficiente en una línea");
        } catch (BusinessException e) {
            assertThat(e).hasMessageContaining("Stock insuficiente");
        }

        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(5);
        assertThat(cantidad(idProductoSinStock, escenario.idAlmacenA())).isEqualTo(1);
        assertThat(filasExistencia(escenario.idProducto(), escenario.idAlmacenB()))
                .as("la fila destino creada dentro de la transacción debe revertirse")
                .isZero();
        assertThat(filasExistencia(idProductoSinStock, escenario.idAlmacenB())).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM movimiento", Long.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_movimiento", Long.class)).isZero();
    }

    @Test
    @DisplayName("bloquear un almacén no bloquea operaciones del mismo producto en otro almacén")
    void operacionesEnAlmacenesDistintosNoSeBloqueanEntreSi() throws Exception {
        EscenarioBase escenario = crearEscenarioBase(10);
        Long idExistenciaB = crearExistencia(escenario.idProducto(), escenario.idAlmacenB(), 20);
        CountDownLatch lockATomado = new CountDownLatch(1);
        CountDownLatch liberarA = new CountDownLatch(1);
        CountDownLatch bTerminoMientrasASigueBloqueado = new CountDownLatch(1);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<?> lockA = pool.submit(() -> transactionTemplate.executeWithoutResult(status -> {
            existenciaLockService.bloquear(escenario.idProducto(), escenario.idAlmacenA()).orElseThrow();
            lockATomado.countDown();
            try {
                if (!bTerminoMientrasASigueBloqueado.await(10, TimeUnit.SECONDS)) {
                    throw new AssertionError("La operación de B no terminó mientras A seguía bloqueado");
                }
                liberarA.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError("Interrupción esperando coordinación de locks", e);
            }
        }));

        assertThat(lockATomado.await(10, TimeUnit.SECONDS)).isTrue();

        Future<?> ajusteB = pool.submit(() -> {
            AjusteExistenciaRequestDTO ajuste = new AjusteExistenciaRequestDTO();
            ajuste.setDeltaCantidadActual(4);
            ajuste.setCantidadMinima(0);
            existenciaService.actualizar(idExistenciaB, ajuste);
            bTerminoMientrasASigueBloqueado.countDown();
            return null;
        });

        ajusteB.get(5, TimeUnit.SECONDS);
        assertThat(bTerminoMientrasASigueBloqueado.getCount()).isZero();
        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenB())).isEqualTo(24);
        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(10);

        liberarA.countDown();
        lockA.get(10, TimeUnit.SECONDS);
        pool.shutdownNow();
        pool.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Test
    @DisplayName("doble aplicación concurrente del mismo conteo solo aplica una diferencia")
    void dobleAplicacionConcurrenteDelMismoConteoSoloAplicaUnaVez() throws Exception {
        EscenarioBase escenario = crearEscenarioBase(9);
        Long idConteo = crearConteoEnRevision(escenario, 12);

        CyclicBarrier salidaSimultanea = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<? extends Future<?>> resultados;
        try {
            resultados = pool.invokeAll(List.of(
                    () -> { salidaSimultanea.await(20, TimeUnit.SECONDS); return conteoService.aplicar(idConteo); },
                    () -> { salidaSimultanea.await(20, TimeUnit.SECONDS); return conteoService.aplicar(idConteo); }));
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        int exitosas = 0;
        List<Throwable> fallidas = new ArrayList<>();
        for (Future<?> resultado : resultados) {
            try {
                resultado.get(30, TimeUnit.SECONDS);
                exitosas++;
            } catch (ExecutionException e) {
                fallidas.add(e.getCause());
            } catch (TimeoutException e) {
                fail("La doble aplicación de conteo no terminó dentro del timeout", e);
            }
        }

        assertThat(exitosas).isEqualTo(1);
        assertThat(fallidas).hasSize(1)
                .allSatisfy(error -> assertThat(error)
                        .isInstanceOf(BusinessException.class)
                        .hasMessageContaining("REVISION")
                        .hasMessageContaining("APLICADO"));
        assertThat(cantidad(escenario.idProducto(), escenario.idAlmacenA())).isEqualTo(12);
        assertThat(conteoCabeceraRepository.findById(idConteo).orElseThrow().getEstado()).isEqualTo("APLICADO");
        assertThat(movimientosPorTipo("AJUSTE")).isEqualTo(1);
        assertThat(detallesMovimientoPorTipo("AJUSTE")).isEqualTo(1);
    }

    private Callable<MovimientoResponseDTO> transferenciaConcurrente(
            CyclicBarrier barrera, Long origen, Long destino, Long producto, int cantidad) {
        return () -> {
            barrera.await(20, TimeUnit.SECONDS);
            return movimientoService.crearTransferencia(transferenciaRequest(origen, destino, Map.of(producto, cantidad)));
        };
    }

    private Callable<?> confirmacionConcurrente(CyclicBarrier barrera, Long idNota) {
        return () -> {
            barrera.await(20, TimeUnit.SECONDS);
            return notaRecepcionService.confirmar(idNota);
        };
    }

    private EscenarioBase crearEscenarioBase(int stockInicialA) {
        EscenarioBase escenario = crearEscenarioBaseSinExistencia();
        crearExistencia(escenario.idProducto(), escenario.idAlmacenA(), stockInicialA);
        return escenario;
    }

    private EscenarioBase crearEscenarioBaseSinExistencia() {
        return transactionTemplate.execute(status -> {
            Rol rol = new Rol();
            rol.setNombre("CONCURRENCIA_IT_" + System.nanoTime());
            rol.setDescripcion("Rol concurrencia inventario");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("concurrencia.it." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);

            Almacen almacenA = crearAlmacen("A");
            Almacen almacenB = crearAlmacen("B");

            Caja caja = new Caja();
            caja.setNombre("Caja concurrencia " + System.nanoTime());
            caja.setEstado("ACTIVO");
            caja.setAlmacen(almacenA);
            caja = cajaRepository.save(caja);

            TurnoCaja turno = new TurnoCaja();
            turno.setCaja(caja);
            turno.setUsuarioApertura(usuario);
            turno.setMontoInicial(new BigDecimal("1000.00"));
            turno.setEstado("ABIERTO");
            turno.setFechaApertura(LocalDateTime.now());
            turno = turnoCajaRepository.save(turno);

            Long idProducto = crearProducto();
            crearResolucion("B02");

            return new EscenarioBase(idProducto, almacenA.getIdAlmacen(), almacenB.getIdAlmacen(),
                    turno.getIdTurnoCaja(), usuario.getIdUsuario(), usuario.getUsername());
        });
    }

    private Almacen crearAlmacen(String sufijo) {
        Almacen almacen = new Almacen();
        almacen.setNombre("Almacen concurrencia " + sufijo + " " + System.nanoTime());
        almacen.setEstado("ACTIVO");
        return almacenRepository.save(almacen);
    }

    private Long crearProducto() {
        Categoria categoria = new Categoria();
        categoria.setNombre("Categoria concurrencia " + System.nanoTime());
        categoria.setEstado("ACTIVO");
        categoria = categoriaRepository.save(categoria);

        Marca marca = new Marca();
        marca.setNombre("Marca concurrencia " + System.nanoTime());
        marca.setEstado("ACTIVO");
        marca = marcaRepository.save(marca);

        Producto producto = new Producto();
        producto.setSku("SKU-CONC-" + System.nanoTime());
        producto.setNombre("Producto concurrencia");
        producto.setPrecioVenta(PRECIO_VENTA);
        producto.setCosto(new BigDecimal("50.00"));
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        return productoRepository.save(producto).getIdProducto();
    }

    private Long crearExistencia(Long idProducto, Long idAlmacen, int cantidad) {
        return transactionTemplate.execute(status -> {
            Existencia existencia = existenciaLockService.obtenerOCrearBloqueada(idProducto, idAlmacen);
            existencia.setCantidadActual(cantidad);
            existencia.setCantidadMinima(0);
            return existencia.getIdExistencia();
        });
    }

    private Long crearConteoEnRevision(EscenarioBase escenario, int cantidadFisica) {
        ConteoCreateRequestDTO crear = new ConteoCreateRequestDTO();
        crear.setIdAlmacen(escenario.idAlmacenA());
        crear.setIdUsuarioAsignado(escenario.idUsuario());
        crear.setZona("Z-" + System.nanoTime());
        Long idConteo = conteoService.crear(crear).getIdConteo();

        ConteoDetalleRequestDTO detalle = new ConteoDetalleRequestDTO();
        detalle.setIdProducto(escenario.idProducto());
        detalle.setCantidadFisica(cantidadFisica);
        ConteoDetallesBatchRequestDTO batch = new ConteoDetallesBatchRequestDTO();
        batch.setLineas(List.of(detalle));
        conteoService.registrarLineas(idConteo, batch);
        conteoService.enviarARevision(idConteo);

        ConteoCabecera cabecera = conteoCabeceraRepository.findById(idConteo).orElseThrow();
        assertThat(cabecera.getEstado()).isEqualTo("REVISION");
        return idConteo;
    }

    private Long crearNotaRecepcion(Long idProducto, Long idAlmacen, int cantidad, String precioUnitario) {
        return transactionTemplate.execute(status -> {
            Proveedor proveedor = new Proveedor();
            proveedor.setNombreEmpresa("Proveedor concurrencia " + System.nanoTime());
            proveedor.setRnc("RNC-" + System.nanoTime());
            proveedor.setEstado("ACTIVO");
            proveedor = proveedorRepository.save(proveedor);

            OrdenCompra orden = new OrdenCompra();
            orden.setProveedor(proveedor);
            orden.setEstado("ENVIADA");
            orden.setTotal(new BigDecimal(precioUnitario).multiply(BigDecimal.valueOf(cantidad)));
            orden = ordenCompraRepository.save(orden);

            Producto producto = productoRepository.findById(idProducto).orElseThrow();
            Almacen almacen = almacenRepository.findById(idAlmacen).orElseThrow();
            DetalleOrdenCompra detalleOrden = new DetalleOrdenCompra();
            detalleOrden.setOrdenCompra(orden);
            detalleOrden.setProducto(producto);
            detalleOrden.setAlmacen(almacen);
            detalleOrden.setCantidad(cantidad);
            detalleOrden.setCantidadRecibida(0);
            detalleOrden.setPrecioUnitario(new BigDecimal(precioUnitario));
            detalleOrden.setSubtotal(new BigDecimal(precioUnitario).multiply(BigDecimal.valueOf(cantidad)));
            detalleOrden = detalleOrdenCompraRepository.save(detalleOrden);

            NotaRecepcion nota = new NotaRecepcion();
            nota.setOrdenCompra(orden);
            nota.setEstado("PENDIENTE");
            nota = notaRecepcionRepository.save(nota);

            DetalleNotaRecepcion detalleNota = new DetalleNotaRecepcion();
            detalleNota.setNotaRecepcion(nota);
            detalleNota.setDetalleOrdenCompra(detalleOrden);
            detalleNota.setAlmacen(almacen);
            detalleNota.setCantidadRecibida(cantidad);
            detalleNota.setObservacion("CONFORME");
            detalleNotaRecepcionRepository.save(detalleNota);
            return nota.getIdNotaRecepcion();
        });
    }

    private CrearVentaRequestDTO ventaRequest(Long idTurnoCaja, Long idProducto, int cantidad, String tipoNcf) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(PRECIO_VENTA.multiply(BigDecimal.valueOf(cantidad)));

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf(tipoNcf);
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return request;
    }

    private MovimientoRequestDTO transferenciaRequest(Long origen, Long destino, Map<Long, Integer> cantidades) {
        MovimientoRequestDTO request = new MovimientoRequestDTO();
        request.setIdAlmacenOrigen(origen);
        request.setIdAlmacenDestino(destino);
        request.setReferencia("TRF-" + System.nanoTime());
        request.setObservacion("Prueba concurrencia ISSUE-004");
        request.setDetalles(cantidades.entrySet().stream().map(entry -> {
            DetalleMovimientoRequestDTO detalle = new DetalleMovimientoRequestDTO();
            detalle.setIdProducto(entry.getKey());
            detalle.setCantidad(entry.getValue());
            return detalle;
        }).toList());
        return request;
    }

    private ResolucionNcf crearResolucion(String tipo) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion concurrencia " + tipo);
        resolucion.setNumeroResolucion("RES-CONC-" + tipo + "-" + System.nanoTime());
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(1000L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        return resolucionNcfRepository.save(resolucion);
    }

    private int cantidad(Long idProducto, Long idAlmacen) {
        return existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacen)
                .orElseThrow().getCantidadActual();
    }

    private long filasExistencia(Long idProducto, Long idAlmacen) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM existencia
                WHERE id_producto = ? AND id_almacen = ?
                """, Long.class, idProducto, idAlmacen);
    }

    private long movimientosPorTipo(String tipo) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM movimiento WHERE tipo = ?", Long.class, tipo);
    }

    private long detallesMovimientoPorTipo(String tipo) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM detalle_movimiento dm
                JOIN movimiento m ON m.id_movimiento = dm.id_movimiento
                WHERE m.tipo = ?
                """, Long.class, tipo);
    }

    private record EscenarioBase(
            Long idProducto,
            Long idAlmacenA,
            Long idAlmacenB,
            Long idTurnoCaja,
            Long idUsuario,
            String username) {
    }
}
