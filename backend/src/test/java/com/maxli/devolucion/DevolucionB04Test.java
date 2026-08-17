package com.maxli.devolucion;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.caja.repository.TurnoCajaRepository;
import com.maxli.cupon.entity.Cupon;
import com.maxli.cupon.entity.TipoDescuento;
import com.maxli.cupon.repository.CuponRepository;
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
import org.junit.jupiter.api.Nested;
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
 * Devoluciones de venta con Nota de Crédito B04.
 * <p>
 * Se prueba contra PostgreSQL real porque lo que se valida no vive en el
 * servicio aislado sino en la transacción: reposición de stock, emisión de
 * NCF, ajuste de caja, estado de la venta y trazabilidad tienen que ocurrir
 * todos o ninguno.
 * <p>
 * Los importes acreditados nunca se recalculan con el precio vigente del
 * producto: salen de los snapshots que la venta dejó en {@code detalle_venta}.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "maxli.security.require-https=false")
@DisplayName("Devoluciones — Nota de Crédito B04")
class DevolucionB04Test extends PostgresIntegrationTest {

    private static final String CAJERO = "cajero.devolucion";
    private static final String OTRO_CAJERO = "cajero.devolucion.otro";
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
    @Autowired private CuponRepository cuponRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long idTurnoCaja;
    private Long idAlmacen;
    private Long idProductoGravado;   // 118.00 con ITBIS 18 %
    private Long idProductoExento;    // 100.00 con ITBIS 0 %
    private Long idProductoImpar;     //  59.00 con ITBIS 18 %

    // ── Escenario ────────────────────────────────────────────────────────

    @BeforeEach
    void sembrarEscenario() {
        transactionTemplate.executeWithoutResult(status -> {
            Rol rol = new Rol();
            rol.setNombre("CAJERO_DEVOLUCION");
            rol.setDescripcion("Rol de prueba de devoluciones");
            rol = rolRepository.save(rol);

            Usuario cajero = crearUsuario(CAJERO, rol);
            crearUsuario(OTRO_CAJERO, rol);

            Almacen almacen = new Almacen();
            almacen.setNombre("Almacen Devoluciones");
            almacen.setEstado("ACTIVO");
            almacen = almacenRepository.save(almacen);
            idAlmacen = almacen.getIdAlmacen();

            Caja caja = new Caja();
            caja.setNombre("Caja Devoluciones");
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
            categoria.setNombre("Categoria Devoluciones");
            categoria.setEstado("ACTIVO");
            categoria = categoriaRepository.save(categoria);

            Marca marca = new Marca();
            marca.setNombre("Marca Devoluciones");
            marca.setEstado("ACTIVO");
            marca = marcaRepository.save(marca);

            idProductoGravado = crearProducto("SKU-DEV-GRAVADO", "Producto gravado",
                    new BigDecimal("118.00"), new BigDecimal("18.00"), categoria, marca, almacen);
            idProductoExento = crearProducto("SKU-DEV-EXENTO", "Producto exento",
                    new BigDecimal("100.00"), new BigDecimal("0.00"), categoria, marca, almacen);
            idProductoImpar = crearProducto("SKU-DEV-IMPAR", "Producto impar",
                    new BigDecimal("59.00"), new BigDecimal("18.00"), categoria, marca, almacen);

            crearResolucion("B02", 1L, 1000L, LocalDate.now().plusYears(1), "ACTIVO");
            crearResolucion("B04", 1L, 1000L, LocalDate.now().plusYears(1), "ACTIVO");

            Cupon cupon = new Cupon();
            cupon.setCodigoInterno("CUPON-DEV");
            cupon.setCodigoSecreto("DEV20");
            cupon.setTipoDescuento(TipoDescuento.MONTO_FIJO);
            cupon.setValorDescuento(new BigDecimal("20.00"));
            cupon.setAplicaTodasCategorias(true);
            cupon.setMontoMinimoCompra(BigDecimal.ZERO);
            cupon.setFechaInicio(LocalDate.now().minusDays(1));
            cupon.setFechaFin(LocalDate.now().plusYears(1));
            cupon.setLimiteUsos(100);
            cupon.setUsosActuales(0);
            cupon.setEstado("ACTIVO");
            cuponRepository.save(cupon);
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
        jdbcTemplate.update("DELETE FROM producto WHERE sku LIKE 'SKU-DEV-%'");
        jdbcTemplate.update("DELETE FROM categoria WHERE nombre = 'Categoria Devoluciones'");
        jdbcTemplate.update("DELETE FROM marca WHERE nombre = 'Marca Devoluciones'");
        jdbcTemplate.update("DELETE FROM almacen WHERE nombre = 'Almacen Devoluciones'");
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
        jdbcTemplate.update("DELETE FROM cupon_categoria");
        jdbcTemplate.update("DELETE FROM cupon WHERE codigo_interno = 'CUPON-DEV'");
        jdbcTemplate.update("DELETE FROM usuario_rol WHERE id_usuario IN "
                + "(SELECT id_usuario FROM usuario WHERE username LIKE 'cajero.devolucion%')");
        jdbcTemplate.update("DELETE FROM usuario WHERE username LIKE 'cajero.devolucion%'");
        jdbcTemplate.update("DELETE FROM rol WHERE nombre = 'CAJERO_DEVOLUCION'");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  1. Devolución completa
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
    @DisplayName("una devolución completa emite B04, repone stock, cierra la venta y acredita el total original")
    void devolucionCompleta() throws Exception {
        VentaResponseDTO venta = venderGravado(2);

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-COMPLETA",
                                linea(venta, 0, 2))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipoNcf").value("B04"))
                .andExpect(jsonPath("$.ncf").value(org.hamcrest.Matchers.startsWith("B04")))
                .andExpect(jsonPath("$.ncfAfectado").value(venta.getNcf()))
                .andExpect(jsonPath("$.numeroControlVenta").value(venta.getNumeroControl()))
                .andExpect(jsonPath("$.estado").value("CONFIRMADA"))
                .andExpect(jsonPath("$.estadoVenta").value("DEVUELTA"))
                .andExpect(jsonPath("$.metodoReembolso").value("EFECTIVO"))
                .andExpect(jsonPath("$.baseImponible").value(200.00))
                .andExpect(jsonPath("$.itbis").value(36.00))
                .andExpect(jsonPath("$.total").value(236.00))
                .andExpect(jsonPath("$.detalles.length()").value(1))
                .andExpect(jsonPath("$.detalles[0].cantidad").value(2));

        // Stock repuesto en el almacén de la venta original
        assertThat(stock(idProductoGravado)).isEqualTo(100);

        // La venta conserva sus importes históricos y solo cambia de estado
        assertThat(estadoVenta(venta.getIdVenta())).isEqualTo("DEVUELTA");
        assertThat(totalVenta(venta.getIdVenta())).isEqualByComparingTo("236.00");

        // Trazabilidad: entrada con usuario, referencia, almacén destino y saldos
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM movimiento WHERE tipo = 'DEVOLUCION'", Long.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT usuario_responsable FROM movimiento WHERE tipo = 'DEVOLUCION'", String.class))
                .isEqualTo(CAJERO);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT id_almacen_destino FROM movimiento WHERE tipo = 'DEVOLUCION'", Long.class))
                .isEqualTo(idAlmacen);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT observacion FROM movimiento WHERE tipo = 'DEVOLUCION'", String.class))
                .contains(venta.getNumeroControl())
                .contains(venta.getNcf());
        assertThat(jdbcTemplate.queryForObject("""
                SELECT cantidad_anterior_destino || '->' || cantidad_posterior_destino
                FROM detalle_movimiento d JOIN movimiento m ON m.id_movimiento = d.id_movimiento
                WHERE m.tipo = 'DEVOLUCION'
                """, String.class))
                .isEqualTo("98->100");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  2. Devoluciones parciales sucesivas y remanente exacto
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
    @DisplayName("tres devoluciones parciales suman exactamente los importes originales")
    void devolucionesParcialesSumanElOriginal() throws Exception {
        // 59.00 × 3 = 177.00 con RD$10.00 de descuento global: los importes por
        // unidad no son divisibles en centavos, así que el remanente exacto solo
        // sale si la última devolución acredita la diferencia.
        VentaResponseDTO venta = vender(idProductoImpar, 3, new BigDecimal("10.00"), null,
                new BigDecimal("167.00"));

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-P1", linea(venta, 0, 1))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoVenta").value("PARCIALMENTE_DEVUELTA"))
                .andExpect(jsonPath("$.baseImponible").value(47.18))
                .andExpect(jsonPath("$.itbis").value(8.49))
                .andExpect(jsonPath("$.total").value(55.67))
                .andExpect(jsonPath("$.detalles[0].descuentoAcreditado").value(3.33))
                .andExpect(jsonPath("$.detalles[0].importeAcreditado").value(59.00));

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-P2", linea(venta, 0, 1))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoVenta").value("PARCIALMENTE_DEVUELTA"));

        // Remanente: acredita la diferencia, no el prorrateo
        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-P3", linea(venta, 0, 1))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoVenta").value("DEVUELTA"))
                .andExpect(jsonPath("$.baseImponible").value(47.17))
                .andExpect(jsonPath("$.total").value(55.66));

        assertThat(sumaAcreditada("base_imponible")).isEqualByComparingTo("141.53");
        assertThat(sumaAcreditada("itbis")).isEqualByComparingTo("25.47");
        assertThat(sumaAcreditada("total")).isEqualByComparingTo(totalVenta(venta.getIdVenta()));
        assertThat(stock(idProductoImpar)).isEqualTo(100);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  3. Descuentos, cupón y tasas de ITBIS distintas
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
    @DisplayName("con descuento de línea, descuento global, cupón y dos tasas de ITBIS, la devolución total cuadra al centavo")
    void devolucionTotalConDescuentosCuponYTasasDistintas() throws Exception {
        DetalleVentaRequestDTO gravado = new DetalleVentaRequestDTO();
        gravado.setIdProducto(idProductoGravado);
        gravado.setCantidad(2);
        gravado.setDescuentoLinea(new BigDecimal("10.00"));

        DetalleVentaRequestDTO exento = new DetalleVentaRequestDTO();
        exento.setIdProducto(idProductoExento);
        exento.setCantidad(1);

        IngresoVentaRequestDTO pago = new IngresoVentaRequestDTO();
        pago.setMetodoPago("EFECTIVO");
        pago.setMonto(new BigDecimal("1000.00"));

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDescuentoGlobal(new BigDecimal("12.00"));
        request.setCodigoCupon("DEV20");
        request.setDetalles(List.of(gravado, exento));
        request.setIngresos(List.of(pago));
        VentaResponseDTO venta = ventaService.procesarVenta(request, CAJERO);

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-MIXTA",
                                linea(venta, 0, 2) + "," + linea(venta, 1, 1))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estadoVenta").value("DEVUELTA"));

        // La nota de crédito acredita exactamente lo que la venta cobró
        assertThat(sumaAcreditada("base_imponible")).isEqualByComparingTo(subtotalVenta(venta.getIdVenta()));
        assertThat(sumaAcreditada("itbis")).isEqualByComparingTo(itbisVenta(venta.getIdVenta()));
        assertThat(sumaAcreditada("total")).isEqualByComparingTo(totalVenta(venta.getIdVenta()));

        // Y línea por línea, con la tasa propia de cada producto
        for (VentaResponseDTO.DetalleVentaResponseDTO detalle : venta.getDetalles()) {
            assertThat(acreditadoPorLinea(detalle.getIdDetalleVenta(), "base_imponible_acreditada"))
                    .as("base acreditada de la línea %d", detalle.getIdDetalleVenta())
                    .isEqualByComparingTo(detalle.getBaseImponible());
            assertThat(acreditadoPorLinea(detalle.getIdDetalleVenta(), "itbis_acreditado"))
                    .as("ITBIS acreditado de la línea %d", detalle.getIdDetalleVenta())
                    .isEqualByComparingTo(detalle.getItbisLinea());
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT tasa_itbis FROM detalle_devolucion WHERE id_producto = ?",
                BigDecimal.class, idProductoExento))
                .isEqualByComparingTo("0.00");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  4. Rechazos sin efectos secundarios
    // ═══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("solicitudes inválidas")
    class SolicitudesInvalidas {

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("devolver más de lo vendido se rechaza con 422 y no toca stock, caja ni NCF")
        void rechazaSobredevolucion() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            long secuenciaAntes = secuenciaB04();

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-SOBRE",
                                    linea(venta, 0, 3))))
                    .andExpect(status().isUnprocessableEntity());

            assertThat(stock(idProductoGravado)).isEqualTo(98);
            assertThat(devoluciones()).isZero();
            assertThat(secuenciaB04()).isEqualTo(secuenciaAntes);
            assertThat(estadoVenta(venta.getIdVenta())).isEqualTo("COMPLETADA");
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("una devolución acumulada por encima de lo vendido se rechaza")
        void rechazaSobredevolucionAcumulada() throws Exception {
            VentaResponseDTO venta = venderGravado(2);

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-ACUM-1",
                                    linea(venta, 0, 1))))
                    .andExpect(status().isCreated());

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-ACUM-2",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isUnprocessableEntity());

            assertThat(stock(idProductoGravado)).isEqualTo(99);
            assertThat(devoluciones()).isEqualTo(1);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("cantidad cero se rechaza con 400 por formato")
        void rechazaCantidadCero() throws Exception {
            VentaResponseDTO venta = venderGravado(2);

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-CERO",
                                    linea(venta, 0, 0))))
                    .andExpect(status().isBadRequest());

            assertThat(stock(idProductoGravado)).isEqualTo(98);
            assertThat(devoluciones()).isZero();
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("una línea de otra venta se rechaza con 422")
        void rechazaLineaAjena() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            VentaResponseDTO ajena = venderGravado(1);

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-AJENA",
                                    linea(ajena, 0, 1))))
                    .andExpect(status().isUnprocessableEntity());

            assertThat(devoluciones()).isZero();
            assertThat(stock(idProductoGravado)).isEqualTo(97);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("la misma línea repetida en la solicitud se rechaza con 422")
        void rechazaLineaDuplicada() throws Exception {
            VentaResponseDTO venta = venderGravado(2);

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-DUP",
                                    linea(venta, 0, 1) + "," + linea(venta, 0, 1))))
                    .andExpect(status().isUnprocessableEntity());

            assertThat(devoluciones()).isZero();
            assertThat(stock(idProductoGravado)).isEqualTo(98);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("una venta inexistente responde 404")
        void ventaInexistente() throws Exception {
            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"idVenta":999999999,"idTurnoCaja":%d,"motivo":"Prueba",
                                     "metodoReembolso":"EFECTIVO","referenciaOperacion":"REF-404",
                                     "detalles":[{"idDetalleVenta":1,"cantidad":1}]}
                                    """.formatted(idTurnoCaja)))
                    .andExpect(status().isNotFound());
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  5. La resolución B04 gobierna toda la transacción
    // ═══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("resolución B04")
    class ResolucionB04 {

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("sin resolución B04 registrada, la devolución revierte entera")
        void sinResolucion() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            jdbcTemplate.update("DELETE FROM resolucion_ncf WHERE tipo_ncf = 'B04'");

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-SIN-B04",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isNotFound());

            assertSinEfectos(venta, 98);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("con resolución B04 vencida, la devolución revierte entera")
        void resolucionVencida() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            jdbcTemplate.update(
                    "UPDATE resolucion_ncf SET fecha_vencimiento = ? WHERE tipo_ncf = 'B04'",
                    LocalDate.now().minusDays(1));

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-VENCIDA",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isUnprocessableEntity());

            assertSinEfectos(venta, 98);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("con resolución B04 agotada, la devolución revierte entera")
        void resolucionAgotada() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            jdbcTemplate.update("UPDATE resolucion_ncf SET estado = 'AGOTADO' WHERE tipo_ncf = 'B04'");

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-AGOTADA",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isUnprocessableEntity());

            assertSinEfectos(venta, 98);
        }

        private void assertSinEfectos(VentaResponseDTO venta, int stockEsperado) {
            assertThat(devoluciones()).as("sin devolución persistida").isZero();
            assertThat(stock(idProductoGravado)).as("stock intacto").isEqualTo(stockEsperado);
            assertThat(estadoVenta(venta.getIdVenta())).isEqualTo("COMPLETADA");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM movimiento WHERE tipo = 'DEVOLUCION'", Long.class))
                    .as("sin movimiento de inventario").isZero();
            assertThat(montoEsperadoTurno())
                    .as("la caja no se ajusta")
                    .isEqualByComparingTo(MONTO_INICIAL.add(venta.getTotal()));
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  6. Caja
    // ═══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("caja")
    class CajaYCuadre {

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER", "CAJA_OPERAR"})
        @DisplayName("el reembolso en efectivo baja el esperado del turno y una venta posterior no lo borra")
        void reembolsoEnEfectivoBajaElEsperado() throws Exception {
            VentaResponseDTO venta = venderGravado(2);   // 236.00 en efectivo
            assertThat(montoEsperadoTurno()).isEqualByComparingTo("1236.00");

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-CAJA-EFECTIVO",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isCreated());

            assertThat(montoEsperadoTurno())
                    .as("el efectivo devuelto salió del cajón")
                    .isEqualByComparingTo("1000.00");

            // Una venta posterior recalcula el cuadre: el ajuste debe sobrevivir.
            venderGravado(1);   // 118.00 en efectivo
            assertThat(montoEsperadoTurno())
                    .as("la venta posterior no borra la devolución")
                    .isEqualByComparingTo("1118.00");

            // Y el cierre cuadra con lo que hay físicamente en el cajón.
            mockMvc.perform(get("/api/cajas/turnos/" + idTurnoCaja + "/cuadre"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.montoEsperado").value(1118.00));
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("un reembolso no efectivo queda registrado pero no altera el efectivo esperado")
        void reembolsoNoEfectivoNoAlteraElCajon() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            assertThat(montoEsperadoTurno()).isEqualByComparingTo("1236.00");

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "TARJETA", "REF-CAJA-TARJETA",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.metodoReembolso").value("TARJETA"));

            assertThat(montoEsperadoTurno())
                    .as("una devolución por tarjeta no saca efectivo del cajón")
                    .isEqualByComparingTo("1236.00");
            assertThat(devoluciones()).isEqualTo(1);
            assertThat(stock(idProductoGravado)).isEqualTo(100);
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("sin turno abierto no se devuelve")
        void exigeTurnoAbierto() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            jdbcTemplate.update("""
                    UPDATE turno_caja
                    SET estado = 'CERRADO', fecha_cierre = NOW(),
                        id_usuario_cierre = id_usuario_apertura, monto_final_declarado = monto_esperado
                    WHERE id_turno_caja = ?
                    """, idTurnoCaja);

            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-SIN-TURNO",
                                    linea(venta, 0, 2))))
                    .andExpect(status().isUnprocessableEntity());

            assertThat(devoluciones()).isZero();
            assertThat(stock(idProductoGravado)).isEqualTo(98);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  7. Idempotencia por referenciaOperacion
    // ═══════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
    @DisplayName("repetir la referencia de operación responde 409 sin repetir stock, caja ni NCF")
    void referenciaRepetidaNoDuplicaLaDevolucion() throws Exception {
        VentaResponseDTO venta = venderGravado(2);
        String cuerpo = cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-IDEMPOTENTE", linea(venta, 0, 1));

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated());

        long secuenciaTrasPrimera = secuenciaB04();
        BigDecimal esperadoTrasPrimera = montoEsperadoTurno();

        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isConflict());

        assertThat(devoluciones()).as("una sola devolución").isEqualTo(1);
        assertThat(stock(idProductoGravado)).as("stock repuesto una sola vez").isEqualTo(99);
        assertThat(secuenciaB04()).as("sin consumir otro B04").isEqualTo(secuenciaTrasPrimera);
        assertThat(montoEsperadoTurno()).isEqualByComparingTo(esperadoTrasPrimera);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  8. Consultas
    // ═══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("consultas")
    class Consultas {

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("el detalle por id devuelve la devolución persistida")
        void detallePorId() throws Exception {
            VentaResponseDTO venta = venderGravado(2);
            String respuesta = mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-DETALLE",
                                    linea(venta, 0, 1))))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            long idDevolucion = idDevolucion(respuesta);

            mockMvc.perform(get("/api/devoluciones/" + idDevolucion))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.idDevolucion").value(idDevolucion))
                    .andExpect(jsonPath("$.referenciaOperacion").value("REF-DETALLE"))
                    .andExpect(jsonPath("$.ncfAfectado").value(venta.getNcf()))
                    .andExpect(jsonPath("$.detalles[0].cantidad").value(1));

            mockMvc.perform(get("/api/devoluciones/999999999"))
                    .andExpect(status().isNotFound());
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("el listado pagina en orden descendente estable y filtra por venta")
        void listadoPaginadoYFiltrado() throws Exception {
            VentaResponseDTO primera = venderGravado(2);
            VentaResponseDTO segunda = venderGravado(2);
            devolver(primera, 1, "REF-L1");
            devolver(primera, 1, "REF-L2");
            devolver(segunda, 1, "REF-L3");

            mockMvc.perform(get("/api/devoluciones").param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(3))
                    .andExpect(jsonPath("$.content[0].referenciaOperacion").value("REF-L3"))
                    .andExpect(jsonPath("$.content[1].referenciaOperacion").value("REF-L2"));

            mockMvc.perform(get("/api/devoluciones")
                            .param("idVenta", String.valueOf(primera.getIdVenta())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(2))
                    .andExpect(jsonPath("$.content[0].referenciaOperacion").value("REF-L2"));
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = {"DEVOLUCION_CREAR", "VENTA_VER"})
        @DisplayName("lo disponible por venta descuenta lo ya devuelto")
        void disponiblePorVenta() throws Exception {
            VentaResponseDTO venta = venderGravado(3);

            mockMvc.perform(get("/api/devoluciones/ventas/" + venta.getIdVenta() + "/disponible"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.idVenta").value(venta.getIdVenta()))
                    .andExpect(jsonPath("$.numeroControl").value(venta.getNumeroControl()))
                    .andExpect(jsonPath("$.lineas.length()").value(1))
                    .andExpect(jsonPath("$.lineas[0].cantidadVendida").value(3))
                    .andExpect(jsonPath("$.lineas[0].cantidadDevuelta").value(0))
                    .andExpect(jsonPath("$.lineas[0].cantidadDisponible").value(3));

            devolver(venta, 2, "REF-DISP");

            mockMvc.perform(get("/api/devoluciones/ventas/" + venta.getIdVenta() + "/disponible"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lineas[0].cantidadDevuelta").value(2))
                    .andExpect(jsonPath("$.lineas[0].cantidadDisponible").value(1));

            mockMvc.perform(get("/api/devoluciones/ventas/999999999/disponible"))
                    .andExpect(status().isNotFound());
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  9. Autorización
    // ═══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("autorización")
    class Autorizacion {

        @Test
        @DisplayName("sin sesión, 401")
        void sinSesion() throws Exception {
            mockMvc.perform(get("/api/devoluciones")).andExpect(status().isUnauthorized());
            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = "VENTA_VER")
        @DisplayName("VENTA_VER permite consultar pero no crear")
        void ventaVerNoCrea() throws Exception {
            VentaResponseDTO venta = venderGravado(2);

            mockMvc.perform(get("/api/devoluciones")).andExpect(status().isOk());
            mockMvc.perform(get("/api/devoluciones/ventas/" + venta.getIdVenta() + "/disponible"))
                    .andExpect(status().isOk());
            mockMvc.perform(post("/api/devoluciones").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(cuerpo(venta.getIdVenta(), "EFECTIVO", "REF-403",
                                    linea(venta, 0, 1))))
                    .andExpect(status().isForbidden());

            assertThat(devoluciones()).isZero();
        }

        @Test
        @WithMockUser(username = CAJERO, authorities = "DEVOLUCION_CREAR")
        @DisplayName("DEVOLUCION_CREAR no da derecho a consultar")
        void devolucionCrearNoConsulta() throws Exception {
            mockMvc.perform(get("/api/devoluciones")).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/devoluciones/1")).andExpect(status().isForbidden());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Usuario crearUsuario(String username, Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setEmail(username + "@maxli.test");
        usuario.setPasswordHash("$2a$10$hashDePruebaNoUsadoEnEsteTest");
        usuario.setEstado("ACTIVO");
        usuario.setRoles(Set.of(rol));
        return usuarioRepository.save(usuario);
    }

    private Long crearProducto(String sku, String nombre, BigDecimal precio, BigDecimal tasaItbis,
                               Categoria categoria, Marca marca, Almacen almacen) {
        Producto producto = new Producto();
        producto.setSku(sku);
        producto.setNombre(nombre);
        producto.setPrecioVenta(precio);
        producto.setCosto(precio.divide(new BigDecimal("2"), 2, java.math.RoundingMode.HALF_UP));
        producto.setTasaItbis(tasaItbis);
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        producto = productoRepository.save(producto);

        Existencia existencia = new Existencia();
        existencia.setProducto(producto);
        existencia.setAlmacen(almacen);
        existencia.setCantidadActual(100);
        existencia.setCantidadMinima(0);
        existenciaRepository.save(existencia);

        return producto.getIdProducto();
    }

    private void crearResolucion(String tipo, long inicio, long fin, LocalDate vencimiento, String estado) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion " + tipo);
        resolucion.setNumeroResolucion("RES-DEV-" + tipo);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(inicio);
        resolucion.setSecuenciaFinal(fin);
        resolucion.setSecuenciaActual(inicio);
        resolucion.setFechaVencimiento(vencimiento);
        resolucion.setEstado(estado);
        resolucionNcfRepository.save(resolucion);
    }

    private VentaResponseDTO venderGravado(int cantidad) {
        return vender(idProductoGravado, cantidad, BigDecimal.ZERO, null,
                new BigDecimal("118.00").multiply(BigDecimal.valueOf(cantidad)));
    }

    private VentaResponseDTO vender(Long idProducto, int cantidad, BigDecimal descuentoGlobal,
                                    String codigoCupon, BigDecimal montoPagado) {
        DetalleVentaRequestDTO detalle = new DetalleVentaRequestDTO();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);

        IngresoVentaRequestDTO ingreso = new IngresoVentaRequestDTO();
        ingreso.setMetodoPago("EFECTIVO");
        ingreso.setMonto(montoPagado);

        CrearVentaRequestDTO request = new CrearVentaRequestDTO();
        request.setIdTurnoCaja(idTurnoCaja);
        request.setTipoNcf("B02");
        request.setMetodoPago("EFECTIVO");
        request.setDescuentoGlobal(descuentoGlobal);
        request.setCodigoCupon(codigoCupon);
        request.setDetalles(List.of(detalle));
        request.setIngresos(List.of(ingreso));
        return ventaService.procesarVenta(request, CAJERO);
    }

    private void devolver(VentaResponseDTO venta, int cantidad, String referencia) throws Exception {
        mockMvc.perform(post("/api/devoluciones").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(venta.getIdVenta(), "EFECTIVO", referencia,
                                linea(venta, 0, cantidad))))
                .andExpect(status().isCreated());
    }

    private String cuerpo(Long idVenta, String metodoReembolso, String referencia, String detalles) {
        return """
                {"idVenta":%d,"idTurnoCaja":%d,"motivo":"Producto defectuoso",
                 "metodoReembolso":"%s","referenciaOperacion":"%s","detalles":[%s]}
                """.formatted(idVenta, idTurnoCaja, metodoReembolso, referencia, detalles);
    }

    private String linea(VentaResponseDTO venta, int indice, int cantidad) {
        return """
                {"idDetalleVenta":%d,"cantidad":%d}
                """.formatted(venta.getDetalles().get(indice).getIdDetalleVenta(), cantidad);
    }

    private long idDevolucion(String respuestaJson) {
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("\"idDevolucion\"\\s*:\\s*(\\d+)").matcher(respuestaJson);
        assertThat(matcher.find()).as("la respuesta trae idDevolucion").isTrue();
        return Long.parseLong(matcher.group(1));
    }

    private int stock(Long idProducto) {
        return jdbcTemplate.queryForObject(
                "SELECT cantidad_actual FROM existencia WHERE id_producto = ?", Integer.class, idProducto);
    }

    private String estadoVenta(Long idVenta) {
        return jdbcTemplate.queryForObject(
                "SELECT estado FROM venta WHERE id_venta = ?", String.class, idVenta);
    }

    private BigDecimal totalVenta(Long idVenta) {
        return jdbcTemplate.queryForObject(
                "SELECT total FROM venta WHERE id_venta = ?", BigDecimal.class, idVenta);
    }

    private BigDecimal subtotalVenta(Long idVenta) {
        return jdbcTemplate.queryForObject(
                "SELECT subtotal FROM venta WHERE id_venta = ?", BigDecimal.class, idVenta);
    }

    private BigDecimal itbisVenta(Long idVenta) {
        return jdbcTemplate.queryForObject(
                "SELECT itbis FROM venta WHERE id_venta = ?", BigDecimal.class, idVenta);
    }

    private BigDecimal sumaAcreditada(String columna) {
        return jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(" + columna + "), 0) FROM devolucion", BigDecimal.class);
    }

    private BigDecimal acreditadoPorLinea(Long idDetalleVenta, String columna) {
        return jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(" + columna + "), 0) FROM detalle_devolucion WHERE id_detalle_venta = ?",
                BigDecimal.class, idDetalleVenta);
    }

    private long devoluciones() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM devolucion", Long.class);
    }

    private long secuenciaB04() {
        return jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(secuencia_actual), 0) FROM resolucion_ncf WHERE tipo_ncf = 'B04'",
                Long.class);
    }

    private BigDecimal montoEsperadoTurno() {
        return jdbcTemplate.queryForObject(
                "SELECT monto_esperado FROM turno_caja WHERE id_turno_caja = ?",
                BigDecimal.class, idTurnoCaja);
    }
}
