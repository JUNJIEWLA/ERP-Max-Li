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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ISSUE-009 — NCF dentro del caso de uso de venta")
class VentaNcfIssue009Test extends PostgresIntegrationTest {

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
    private Long idTurnoCaja;
    private Long idResolucionB02;
    private Long idExistencia;
    private String username;

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_NCF_" + System.nanoTime());
            rol.setDescripcion("Rol de prueba NCF venta");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("cajero.ncf." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);
            username = usuario.getUsername();

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen NCF " + System.nanoTime());
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Caja caja = new Caja();
            caja.setNombre("Caja NCF " + System.nanoTime());
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
            categoria.setNombre("Categoria NCF " + System.nanoTime());
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca NCF " + System.nanoTime());
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-NCF-" + System.nanoTime());
            producto.setNombre("Producto venta NCF");
            producto.setPrecioVenta(PRECIO_VENTA);
            producto.setCosto(new BigDecimal("50.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            idProducto = productoRepository.save(producto).getIdProducto();

            Existencia existencia = new Existencia();
            existencia.setProducto(producto);
            existencia.setAlmacen(almacen);
            existencia.setCantidadActual(20);
            existencia.setCantidadMinima(0);
            idExistencia = existenciaRepository.save(existencia).getIdExistencia();

            idResolucionB02 = resolucionNcfRepository.save(resolucionB02()).getIdResolucion();
        });
    }

    @AfterEach
    void limpiarEscenario() {
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
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.ncf.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.ncf.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CAJERO_NCF_%'");
    }

    @Test
    @DisplayName("ventas concurrentes generan NCF únicos y secuenciales dentro de la venta")
    void ventasConcurrentesGeneranNcfUnicosYSecuenciales() throws Exception {
        CyclicBarrier barrera = new CyclicBarrier(8);
        ExecutorService pool = Executors.newFixedThreadPool(8);

        List<Future<VentaResponseDTO>> resultados;
        try {
            List<Callable<VentaResponseDTO>> tareas = java.util.stream.IntStream.range(0, 8)
                    .mapToObj(i -> (Callable<VentaResponseDTO>) () -> {
                        barrera.await(20, TimeUnit.SECONDS);
                        return ventaService.procesarVenta(requestVenta(PRECIO_VENTA), username);
                    })
                    .toList();
            resultados = pool.invokeAll(tareas);
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        List<String> ncf = resultados.stream().map(future -> {
            try {
                return future.get().getNcf();
            } catch (Exception e) {
                throw new AssertionError(e);
            }
        }).sorted().toList();

        assertThat(ncf).containsExactly(
                "B0200000001", "B0200000002", "B0200000003", "B0200000004",
                "B0200000005", "B0200000006", "B0200000007", "B0200000008");
        assertThat(secuenciaActual()).isEqualTo(9L);
        assertThat(ventaRepository.count()).isEqualTo(8);
    }

    @Test
    @DisplayName("si la venta revierte después de generar NCF, la secuencia no queda consumida")
    void rollbackDespuesDeGenerarNcfNoConsumeSecuencia() {
        assertThatThrownBy(() -> ventaService.procesarVenta(requestVenta(new BigDecimal("50.00")), username))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("monto pagado");

        assertThat(secuenciaActual()).isEqualTo(1L);
        assertThat(ventaRepository.count()).isZero();
        assertThat(existenciaRepository.findById(idExistencia).orElseThrow().getCantidadActual()).isEqualTo(20);
    }

    private CrearVentaRequestDTO requestVenta(BigDecimal montoPagado) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(1);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(montoPagado);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return request;
    }

    private ResolucionNcf resolucionB02() {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf("B02");
        resolucion.setDescripcion("Consumo");
        resolucion.setNumeroResolucion("RES-VENTA-B02");
        resolucion.setPrefijo("B02");
        resolucion.setSecuenciaInicio(1L);
        resolucion.setSecuenciaFinal(20L);
        resolucion.setSecuenciaActual(1L);
        resolucion.setFechaVencimiento(LocalDate.now().plusYears(1));
        resolucion.setEstado("ACTIVO");
        return resolucion;
    }

    private Long secuenciaActual() {
        return jdbcTemplate.queryForObject(
                "SELECT secuencia_actual FROM resolucion_ncf WHERE id_resolucion = ?",
                Long.class, idResolucionB02);
    }
}
