package com.maxli.venta.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.cupon.entity.Cupon;
import com.maxli.cupon.entity.TipoDescuento;
import com.maxli.cupon.repository.CuponRepository;
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
import com.maxli.venta.dto.RecalcularFacturaRequestDTO;
import com.maxli.venta.dto.RecalcularFacturaResponseDTO;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ISSUE-008 — el preview y la venta dividían siempre el total entre 1.18,
 * ignorando la tasa ITBIS propia de cada producto (Producto.tasaItbis).
 * Estas pruebas fijan el comportamiento correcto: base imponible e ITBIS
 * calculados por línea, con prorrateo consistente de descuento global y
 * cupón, y reconciliación exacta al centavo.
 */
@DisplayName("ISSUE-008 — ITBIS calculado por línea según la tasa del producto")
class VentaItbisPorLineaTest extends PostgresIntegrationTest {

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
    @Autowired private CuponRepository cuponRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idAlmacen;
    private Long idCategoria;
    private Long idMarca;
    private Long idTurnoCaja;
    private Long idResolucionB02;
    private String username;

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_ITBIS_" + System.nanoTime());
            rol.setDescripcion("Rol de prueba ITBIS por línea");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("cajero.itbis." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);
            username = usuario.getUsername();

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen ITBIS " + System.nanoTime());
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);
            idAlmacen = almacen.getIdAlmacen();

            Caja caja = new Caja();
            caja.setNombre("Caja ITBIS " + System.nanoTime());
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
            categoria.setNombre("Categoria ITBIS " + System.nanoTime());
            categoria.setEstado("ACTIVO");
            idCategoria = categoriaRepository.save(categoria).getIdCategoria();

            Marca marca = new Marca();
            marca.setNombre("Marca ITBIS " + System.nanoTime());
            marca.setEstado("ACTIVO");
            idMarca = marcaRepository.save(marca).getIdMarca();

            idResolucionB02 = crearResolucion("B02", "Consumo ITBIS").getIdResolucion();
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
        jdbcTemplate.update("DELETE FROM cupon_categoria");
        jdbcTemplate.update("DELETE FROM cupon");
        jdbcTemplate.update("DELETE FROM producto");
        jdbcTemplate.update("DELETE FROM categoria");
        jdbcTemplate.update("DELETE FROM marca");
        jdbcTemplate.update("DELETE FROM almacen");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.itbis.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.itbis.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CAJERO_ITBIS_%'");
    }

    // ── 1. Producto exento ──────────────────────────────────────────────

    @Test
    @DisplayName("un producto exento (tasaItbis=0) no genera ITBIS")
    void productoExentoNoGeneraItbis() {
        Long idProducto = crearProductoConStock(new BigDecimal("100.00"), BigDecimal.ZERO, 10);

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(List.of(detalle(idProducto, 1)), BigDecimal.ZERO, null), username);

        assertThat(venta.getSubtotal()).isEqualByComparingTo("100.00");
        assertThat(venta.getItbis()).isEqualByComparingTo("0.00");
        assertThat(venta.getTotal()).isEqualByComparingTo("100.00");
    }

    // ── 2. Producto gravado 18% (regresión) ─────────────────────────────

    @Test
    @DisplayName("un producto gravado al 18% calcula el ITBIS igual que antes")
    void productoGravado18PorCientoCalculaItbisCorrecto() {
        Long idProducto = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(List.of(detalle(idProducto, 1)), BigDecimal.ZERO, null), username);

        assertThat(venta.getSubtotal()).isEqualByComparingTo("100.00");
        assertThat(venta.getItbis()).isEqualByComparingTo("18.00");
        assertThat(venta.getTotal()).isEqualByComparingTo("118.00");
    }

    // ── 3. Venta con tasas mixtas ────────────────────────────────────────

    @Test
    @DisplayName("una venta con tasas mixtas calcula el ITBIS por línea, no sobre el total")
    void ventaConTasasMixtasCalculaItbisPorLinea() {
        Long idGravado = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);
        Long idExento = crearProductoConStock(new BigDecimal("50.00"), BigDecimal.ZERO, 10);

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(List.of(detalle(idGravado, 1), detalle(idExento, 1)), BigDecimal.ZERO, null),
                username);

        assertThat(venta.getSubtotal()).isEqualByComparingTo("150.00");
        assertThat(venta.getItbis()).isEqualByComparingTo("18.00");
        assertThat(venta.getTotal()).isEqualByComparingTo("168.00");

        // El bug del ISSUE-008 dividía el total (168.00) entre 1.18 sin mirar
        // la tasa de cada línea, dando subtotal=142.37 / itbis=25.63.
        assertThat(venta.getItbis()).isNotEqualByComparingTo("25.63");
        assertThat(venta.getSubtotal()).isNotEqualByComparingTo("142.37");
    }

    // ── 4. Cupón — paridad preview/persistida y no consumo en preview ──

    @Test
    @DisplayName("el cupón produce los mismos totales en preview y en la venta, sin consumir su límite en el preview")
    void cuponPreviewYPersistidaCoincidenSinConsumirLimiteEnElPreview() {
        Long idProducto = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);
        Cupon cupon = crearCupon("PREVIEW10", TipoDescuento.MONTO_FIJO, new BigDecimal("10.00"), 1);

        RecalcularFacturaResponseDTO preview = null;
        for (int i = 0; i < 3; i++) {
            preview = ventaService.recalcularFactura(
                    construirRecalculo(List.of(detalle(idProducto, 1)), BigDecimal.ZERO, cupon.getCodigoSecreto()));
        }

        assertThat(cuponRepository.findById(cupon.getIdCupon()).orElseThrow().getUsosActuales())
                .as("el preview no debe consumir el límite de usos del cupón")
                .isZero();

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(List.of(detalle(idProducto, 1)), BigDecimal.ZERO, cupon.getCodigoSecreto()),
                username);

        assertThat(venta.getSubtotal()).isEqualByComparingTo(preview.getSubtotal());
        assertThat(venta.getItbis()).isEqualByComparingTo(preview.getItbis());
        assertThat(venta.getTotal()).isEqualByComparingTo(preview.getTotal());

        assertThat(cuponRepository.findById(cupon.getIdCupon()).orElseThrow().getUsosActuales())
                .as("la venta real sí consume el uso del cupón")
                .isEqualTo(1);
    }

    // ── 5. Descuento global prorrateado en carrito mixto ─────────────────

    @Test
    @DisplayName("el descuento global se prorratea entre líneas de distinta tasa y el total reconcilia exacto")
    void descuentoGlobalSeProrrateaEntreLineasDeDistintaTasa() {
        Long idGravado = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);
        Long idExento = crearProductoConStock(new BigDecimal("50.00"), BigDecimal.ZERO, 10);

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(
                        List.of(detalle(idGravado, 1), detalle(idExento, 1)),
                        new BigDecimal("18.00"), null),
                username);

        assertThat(venta.getSubtotal()).isEqualByComparingTo("133.93");
        assertThat(venta.getItbis()).isEqualByComparingTo("16.07");
        assertThat(venta.getTotal()).isEqualByComparingTo("150.00");
        assertThat(venta.getSubtotal().add(venta.getItbis())).isEqualByComparingTo(venta.getTotal());
    }

    // ── 6. Validación de descuentos — rechazo sin efectos secundarios ───

    @Test
    @DisplayName("un descuento de línea fuera de 0-100 se rechaza sin consumir NCF, stock ni caja")
    void descuentoDeLineaFueraDeRangoSeRechazaSinEfectosSecundarios() {
        Long idProducto = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);

        CrearVentaRequestDTO request = construirRequest(
                List.of(detalle(idProducto, 1, new BigDecimal("150.00"))), BigDecimal.ZERO, null);

        assertThatThrownBy(() -> ventaService.procesarVenta(request, username))
                .isInstanceOf(BusinessException.class);

        assertSinEfectosSecundarios(idProducto, 10);
    }

    @Test
    @DisplayName("un descuento global negativo se rechaza sin consumir NCF, stock ni caja")
    void descuentoGlobalNegativoSeRechazaSinEfectosSecundarios() {
        Long idProducto = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);

        CrearVentaRequestDTO request = construirRequest(
                List.of(detalle(idProducto, 1)), new BigDecimal("-10.00"), null);

        assertThatThrownBy(() -> ventaService.procesarVenta(request, username))
                .isInstanceOf(BusinessException.class);

        assertSinEfectosSecundarios(idProducto, 10);
    }

    // ── 7. Redondeo — método del mayor resto ────────────────────────────

    @Test
    @DisplayName("el prorrateo de descuento reconcilia exacto al centavo aunque no divida parejo")
    void prorrateoDeDescuentoReconciliaExactoAlCentavo() {
        Long idA = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);
        Long idB = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);
        Long idC = crearProductoConStock(new BigDecimal("118.00"), new BigDecimal("18.00"), 10);

        VentaResponseDTO venta = ventaService.procesarVenta(
                construirRequest(
                        List.of(detalle(idA, 1), detalle(idB, 1), detalle(idC, 1)),
                        new BigDecimal("1.00"), null),
                username);

        assertThat(venta.getTotal()).isEqualByComparingTo("353.00");
        assertThat(venta.getSubtotal().add(venta.getItbis())).isEqualByComparingTo(venta.getTotal());

        BigDecimal sumaBase = venta.getDetalles().stream()
                .map(VentaResponseDTO.DetalleVentaResponseDTO::getBaseImponible)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sumaItbis = venta.getDetalles().stream()
                .map(VentaResponseDTO.DetalleVentaResponseDTO::getItbisLinea)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(sumaBase).isEqualByComparingTo(venta.getSubtotal());
        assertThat(sumaItbis).isEqualByComparingTo(venta.getItbis());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void assertSinEfectosSecundarios(Long idProducto, int stockEsperado) {
        assertThat(secuenciaActual(idResolucionB02))
                .as("la resolución NCF no avanzó")
                .isEqualTo(1L);
        assertThat(ventaRepository.count())
                .as("no se persistió ninguna venta")
                .isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM detalle_venta", Long.class))
                .as("no quedan detalles huérfanos")
                .isZero();
        assertThat(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacen)
                .orElseThrow().getCantidadActual())
                .as("el stock no se tocó")
                .isEqualTo(stockEsperado);

        TurnoCaja turnoFinal = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turnoFinal.getTotalVentasEfectivo())
                .as("el cuadre del turno no se movió")
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    private Long crearProductoConStock(BigDecimal precioVenta, BigDecimal tasaItbis, int stock) {
        return transactionTemplate.execute(status -> {
            Producto producto = new Producto();
            producto.setSku("SKU-ITBIS-" + System.nanoTime());
            producto.setNombre("Producto ITBIS " + tasaItbis);
            producto.setPrecioVenta(precioVenta);
            producto.setCosto(new BigDecimal("10.00"));
            producto.setTasaItbis(tasaItbis);
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoriaRepository.findById(idCategoria).orElseThrow());
            producto.setMarca(marcaRepository.findById(idMarca).orElseThrow());
            Producto guardado = productoRepository.save(producto);

            Existencia existencia = new Existencia();
            existencia.setProducto(guardado);
            existencia.setAlmacen(almacenRepository.findById(idAlmacen).orElseThrow());
            existencia.setCantidadActual(stock);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            return guardado.getIdProducto();
        });
    }

    private Cupon crearCupon(String codigoSecreto, TipoDescuento tipo, BigDecimal valor, int limiteUsos) {
        return transactionTemplate.execute(status -> {
            Cupon cupon = new Cupon();
            cupon.setCodigoInterno("CUPON-ITBIS-" + System.nanoTime());
            cupon.setCodigoSecreto(codigoSecreto);
            cupon.setTipoDescuento(tipo);
            cupon.setValorDescuento(valor);
            cupon.setAplicaTodasCategorias(true);
            cupon.setMontoMinimoCompra(BigDecimal.ZERO);
            cupon.setFechaInicio(LocalDate.now());
            cupon.setLimiteUsos(limiteUsos);
            cupon.setEstado("ACTIVO");
            return cuponRepository.save(cupon);
        });
    }

    private DetalleVentaRequestDTO detalle(Long idProducto, int cantidad) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);
        return detalle;
    }

    private DetalleVentaRequestDTO detalle(Long idProducto, int cantidad, BigDecimal descuentoLinea) {
        DetalleVentaRequestDTO detalle = detalle(idProducto, cantidad);
        detalle.setDescuentoLinea(descuentoLinea);
        return detalle;
    }

    private CrearVentaRequestDTO construirRequest(
            List<DetalleVentaRequestDTO> detalles, BigDecimal descuentoGlobal, String codigoCupon) {
        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDescuentoGlobal(descuentoGlobal);
        request.setCodigoCupon(codigoCupon);
        request.setDetalles(detalles);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(new BigDecimal("100000.00"));
        request.setIngresos(List.of(ingreso));
        return request;
    }

    private RecalcularFacturaRequestDTO construirRecalculo(
            List<DetalleVentaRequestDTO> detalles, BigDecimal descuentoGlobal, String codigoCupon) {
        RecalcularFacturaRequestDTO request = new RecalcularFacturaRequestDTO();
        request.setMetodoPago("EFECTIVO");
        request.setTipoNcf("B02");
        request.setDescuentoGlobal(descuentoGlobal);
        request.setCodigoCupon(codigoCupon);
        request.setDetalles(detalles);
        return request;
    }

    private ResolucionNcf crearResolucion(String tipo, String descripcion) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion(descripcion);
        resolucion.setNumeroResolucion("RES-ITBIS-" + tipo);
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
