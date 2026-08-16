package com.maxli.caja.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.dto.AbrirTurnoCajaRequestDTO;
import com.maxli.caja.dto.CerrarTurnoCajaRequestDTO;
import com.maxli.caja.dto.CuadreTurnoCajaResponseDTO;
import com.maxli.caja.dto.TurnoCajaResponseDTO;
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
import com.maxli.venta.service.VentaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Reproduce ISSUE-006: el cambio devuelto al cliente se contaba como efectivo
 * en caja. Una venta de RD$130 pagada con RD$200 subía el turno RD$200 en vez
 * de RD$130, porque el cuadre sumaba {@code IngresoVenta.monto} completo y
 * nunca descontaba {@code Venta.cambio}.
 * <p>
 * Además cubre la composición de pagos: el método principal debe coincidir con
 * los ingresos declarados, y solo se admite sobrepago cuando hay efectivo del
 * cual devolver el cambio.
 * <p>
 * Es una prueba de integración contra PostgreSQL real: el fallo vive en la
 * consulta de agregación del cuadre, así que mockear el repositorio no probaría
 * nada.
 */
@DisplayName("ISSUE-006 — Cuadre de caja con efectivo neto")
class CuadreCajaEfectivoTest extends PostgresIntegrationTest {

    private static final BigDecimal MONTO_INICIAL = new BigDecimal("1000.00");
    private static final BigDecimal PRECIO_VENTA = new BigDecimal("130.00");
    private static final int STOCK_INICIAL = 100;

    @Autowired private VentaService ventaService;
    @Autowired private TurnoCajaService turnoCajaService;
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
    private String username;

    /**
     * Turno abierto con RD$1,000 de fondo, un producto de RD$130 y stock de
     * sobra: es el escenario que el auditor usó para destapar el hallazgo.
     */
    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_CAJA_" + System.nanoTime());
            rol.setDescripcion("Rol de prueba de cuadre de caja");
            rol = rolRepository.save(rol);

            Usuario usuario = new Usuario();
            usuario.setUsername("cajero.caja." + System.nanoTime());
            usuario.setEmail(usuario.getUsername() + "@maxli.test");
            usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
            usuario.setEstado("ACTIVO");
            usuario.setRoles(Set.of(rol));
            usuario = usuarioRepository.save(usuario);
            username = usuario.getUsername();

            Caja caja = new Caja();
            caja.setNombre("Caja Cuadre " + System.nanoTime());
            caja.setEstado("ACTIVO");
            caja = cajaRepository.save(caja);

            // Se abre por el servicio real: así el turno arranca con el mismo
            // cuadre que tendría en producción (esperado = fondo inicial).
            AbrirTurnoCajaRequestDTO apertura = new AbrirTurnoCajaRequestDTO();
            apertura.setIdCaja(caja.getIdCaja());
            apertura.setMontoInicial(MONTO_INICIAL);
            apertura.setObservacionApertura("Apertura de prueba ISSUE-006");
            idTurnoCaja = turnoCajaService.abrir(apertura, username).getIdTurnoCaja();

            Categoria categoria = new Categoria();
            categoria.setNombre("Categoria Cuadre " + System.nanoTime());
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Cuadre " + System.nanoTime());
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            Producto producto = new Producto();
            producto.setSku("SKU-CAJA-" + System.nanoTime());
            producto.setNombre("Producto de cuadre");
            producto.setPrecioVenta(PRECIO_VENTA);
            producto.setCosto(new BigDecimal("65.00"));
            producto.setEstado("ACTIVO");
            producto.setCategoria(categoria);
            producto.setMarca(marca);
            idProducto = productoRepository.save(producto).getIdProducto();

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Cuadre " + System.nanoTime());
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);

            Existencia existencia = new Existencia();
            existencia.setProducto(producto);
            existencia.setAlmacen(almacen);
            existencia.setCantidadActual(STOCK_INICIAL);
            existencia.setCantidadMinima(0);
            existenciaRepository.save(existencia);

            idResolucionB02 = crearResolucion().getIdResolucion();
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
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.caja.%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.caja.%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre LIKE 'CAJERO_CAJA_%'");
    }

    // ── Efectivo ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("venta de RD$130 pagada con RD$200: la caja sube RD$130, no RD$200")
    void efectivoConCambio_soloCuentaElNetoQueQuedaEnCaja() {
        VentaResponseDTO venta = ventaService.procesarVenta(
                request("EFECTIVO", ingreso("EFECTIVO", "200.00")), username);

        // El cliente entregó 200 por una venta de 130 y se llevó 70 de vuelta.
        assertThat(venta.getTotal()).isEqualByComparingTo("130.00");
        assertThat(venta.getMontoRecibido()).isEqualByComparingTo("200.00");
        assertThat(venta.getCambio()).isEqualByComparingTo("70.00");

        // En el cajón solo quedaron los 130 de la venta.
        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasEfectivo())
                .as("efectivo neto = 200 recibidos - 70 de cambio")
                .isEqualByComparingTo("130.00");
        assertThat(turno.getMontoEsperado())
                .as("1000 de fondo + 130 de efectivo neto")
                .isEqualByComparingTo("1130.00");

        // El endpoint de cuadre reporta lo mismo que quedó persistido.
        CuadreTurnoCajaResponseDTO cuadre = turnoCajaService.calcularCuadre(idTurnoCaja);
        assertThat(cuadre.getTotalVentasEfectivo()).isEqualByComparingTo("130.00");
        assertThat(cuadre.getMontoEsperado()).isEqualByComparingTo("1130.00");
    }

    @Test
    @DisplayName("efectivo exacto: sin cambio, la caja sube el total completo")
    void efectivoExacto_sumaElTotalCompleto() {
        VentaResponseDTO venta = ventaService.procesarVenta(
                request("EFECTIVO", ingreso("EFECTIVO", "130.00")), username);

        assertThat(venta.getCambio()).isEqualByComparingTo("0.00");

        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasEfectivo()).isEqualByComparingTo("130.00");
        assertThat(turno.getMontoEsperado()).isEqualByComparingTo("1130.00");
    }

    // ── Métodos no efectivos ─────────────────────────────────────────────

    @Test
    @DisplayName("tarjeta: no entra dinero al cajón, el efectivo esperado no cambia")
    void tarjeta_noAfectaElEfectivoDeCaja() {
        ventaService.procesarVenta(request("TARJETA", ingreso("TARJETA", "130.00")), username);

        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasTarjeta()).isEqualByComparingTo("130.00");
        assertThat(turno.getTotalVentasEfectivo()).isEqualByComparingTo("0.00");
        assertThat(turno.getMontoEsperado())
                .as("el cajón sigue teniendo solo el fondo inicial")
                .isEqualByComparingTo("1000.00");
    }

    @Test
    @DisplayName("transferencia: no entra dinero al cajón, el efectivo esperado no cambia")
    void transferencia_noAfectaElEfectivoDeCaja() {
        ventaService.procesarVenta(
                request("TRANSFERENCIA", ingreso("TRANSFERENCIA", "130.00")), username);

        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasTransferencia()).isEqualByComparingTo("130.00");
        assertThat(turno.getTotalVentasEfectivo()).isEqualByComparingTo("0.00");
        assertThat(turno.getMontoEsperado()).isEqualByComparingTo("1000.00");
    }

    // ── Pago mixto ───────────────────────────────────────────────────────

    @Test
    @DisplayName("mixto tarjeta 100 + efectivo 50: la caja solo sube el efectivo neto")
    void pagoMixto_soloCuentaLaPorcionEnEfectivoNeta() {
        VentaResponseDTO venta = ventaService.procesarVenta(
                request("MIXTO", ingreso("TARJETA", "100.00"), ingreso("EFECTIVO", "50.00")),
                username);

        // 150 cobrados por una venta de 130 → 20 de cambio, que salen del efectivo.
        assertThat(venta.getCambio()).isEqualByComparingTo("20.00");

        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasTarjeta()).isEqualByComparingTo("100.00");
        assertThat(turno.getTotalVentasEfectivo())
                .as("efectivo neto = 50 recibidos - 20 de cambio")
                .isEqualByComparingTo("30.00");
        assertThat(turno.getMontoEsperado()).isEqualByComparingTo("1030.00");
    }

    // ── Composición de pagos ─────────────────────────────────────────────

    @Test
    @DisplayName("rechaza un ingreso con método distinto al principal declarado")
    void rechazaIngresoConMetodoDistintoAlPrincipal() {
        assertThatThrownBy(() -> ventaService.procesarVenta(
                request("EFECTIVO", ingreso("TARJETA", "130.00")), username))
                .isInstanceOf(BusinessException.class);

        assertThat(ventaRepository.count()).as("la venta no se persiste").isZero();

        TurnoCaja turno = turnoCajaRepository.findById(idTurnoCaja).orElseThrow();
        assertThat(turno.getTotalVentasEfectivo()).isEqualByComparingTo("0.00");
        assertThat(turno.getMontoEsperado())
                .as("el cuadre queda intacto")
                .isEqualByComparingTo("1000.00");
    }

    @Test
    @DisplayName("rechaza varios métodos de cobro si el principal no es MIXTO")
    void rechazaVariosMetodosSiElPrincipalNoEsMixto() {
        assertThatThrownBy(() -> ventaService.procesarVenta(
                request("EFECTIVO", ingreso("EFECTIVO", "50.00"), ingreso("TARJETA", "80.00")),
                username))
                .isInstanceOf(BusinessException.class);

        assertThat(ventaRepository.count()).isZero();
    }

    @Test
    @DisplayName("rechaza MIXTO cuando los ingresos usan un solo método")
    void rechazaMixtoConUnSoloMetodo() {
        assertThatThrownBy(() -> ventaService.procesarVenta(
                request("MIXTO", ingreso("EFECTIVO", "130.00")), username))
                .isInstanceOf(BusinessException.class);

        assertThat(ventaRepository.count()).isZero();
    }

    // ── Sobrepago ────────────────────────────────────────────────────────

    @Test
    @DisplayName("rechaza cobrar RD$200 con tarjeta por una venta de RD$130")
    void rechazaSobrepagoSinEfectivo() {
        assertThatThrownBy(() -> ventaService.procesarVenta(
                request("TARJETA", ingreso("TARJETA", "200.00")), username))
                .isInstanceOf(BusinessException.class);

        assertThat(ventaRepository.count()).isZero();
        assertThat(secuenciaActual(idResolucionB02))
                .as("un request inválido no debe consumir NCF")
                .isEqualTo(1L);
    }

    @Test
    @DisplayName("rechaza un cambio mayor que el efectivo recibido")
    void rechazaCambioMayorQueElEfectivoRecibido() {
        // Tarjeta 140 + efectivo 10 por una venta de 130: el cambio de 20 no
        // cabe en los 10 que entregó el cliente.
        assertThatThrownBy(() -> ventaService.procesarVenta(
                request("MIXTO", ingreso("TARJETA", "140.00"), ingreso("EFECTIVO", "10.00")),
                username))
                .isInstanceOf(BusinessException.class);

        assertThat(ventaRepository.count()).isZero();
    }

    // ── Cierre de turno ──────────────────────────────────────────────────

    @Test
    @DisplayName("cierre de turno: declarar RD$1,130 tras la venta con cambio cuadra en cero")
    void cierreDeTurno_usaElEfectivoNetoParaLaDiferencia() {
        ventaService.procesarVenta(request("EFECTIVO", ingreso("EFECTIVO", "200.00")), username);

        CerrarTurnoCajaRequestDTO cierre = new CerrarTurnoCajaRequestDTO();
        cierre.setMontoFinalDeclarado(new BigDecimal("1130.00"));
        cierre.setObservacionCierre("Cierre de prueba ISSUE-006");

        TurnoCajaResponseDTO cerrado = turnoCajaService.cerrar(idTurnoCaja, cierre, username);

        assertThat(cerrado.getEstado()).isEqualTo("CERRADO");
        assertThat(cerrado.getTotalVentasEfectivo()).isEqualByComparingTo("130.00");
        assertThat(cerrado.getMontoEsperado()).isEqualByComparingTo("1130.00");
        assertThat(cerrado.getDiferencia())
                .as("contando el cambio como efectivo, el cajero aparecía con RD$70 faltantes")
                .isEqualByComparingTo("0.00");
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private CrearVentaRequestDTO request(String metodoPrincipal, IngresoVentaRequestDTO... ingresos) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(1);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago(metodoPrincipal);
        request.setDetalles(List.of(detalle));
        request.setIngresos(Arrays.asList(ingresos));
        return request;
    }

    private IngresoVentaRequestDTO ingreso(String metodoPago, String monto) {
        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago(metodoPago);
        ingreso.setMonto(new BigDecimal(monto));
        return ingreso;
    }

    private ResolucionNcf crearResolucion() {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf("B02");
        resolucion.setDescripcion("Consumo");
        resolucion.setNumeroResolucion("RES-CAJA-B02");
        resolucion.setPrefijo("B02");
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
