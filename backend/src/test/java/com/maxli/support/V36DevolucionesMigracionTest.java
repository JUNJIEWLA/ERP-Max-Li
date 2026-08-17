package com.maxli.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V36 abre exactamente dos puertas —el tipo NCF {@code B04} y el movimiento de
 * inventario {@code DEVOLUCION}— y no debilita ninguna otra restricción: los
 * tipos NCF inventados siguen rechazándose, los movimientos siguen exigiendo su
 * almacén, y una devolución sin almacén destino no entra.
 */
@DisplayName("V36 — Devoluciones y Nota de Crédito B04")
class V36DevolucionesMigracionTest {

    private EmbeddedPostgres postgres;
    private DataSource dataSource;

    @BeforeEach
    void arrancarPostgresYMigrar() throws IOException, SQLException {
        postgres = EmbeddedPostgres.builder().start();
        dataSource = postgres.getPostgresDatabase();
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        ejecutar("INSERT INTO almacen (nombre, estado) VALUES ('Almacen V36', 'ACTIVO')");
    }

    @AfterEach
    void apagarPostgres() throws IOException {
        postgres.close();
    }

    // ── NCF ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("acepta una resolución B04 y sigue rechazando tipos inventados")
    void permiteB04SinAbrirOtrosTipos() {
        assertThatCode(() -> insertarResolucion("B04", "B04")).doesNotThrowAnyException();
        assertThatCode(() -> insertarResolucion("B02", "B02")).doesNotThrowAnyException();

        assertThatThrownBy(() -> insertarResolucion("B03", "B03"))
                .hasMessageContaining("chk_resolucion_ncf_tipo_prefijo");
        assertThatThrownBy(() -> insertarResolucion("B04", "B02"))
                .as("el prefijo tiene que seguir coincidiendo con el tipo")
                .hasMessageContaining("chk_resolucion_ncf_tipo_prefijo");
    }

    // ── Inventario ───────────────────────────────────────────────────────

    @Test
    @DisplayName("acepta el movimiento DEVOLUCION con almacén destino y lo rechaza sin él")
    void permiteDevolucionComoEntrada() {
        assertThatCode(() -> insertarMovimiento("DEVOLUCION", null, "Almacen V36"))
                .doesNotThrowAnyException();

        assertThatThrownBy(() -> insertarMovimiento("DEVOLUCION", null, null))
                .as("una devolución sin almacén destino no repone nada")
                .hasMessageContaining("chk_movimiento_almacenes");
    }

    @Test
    @DisplayName("las demás reglas de movimiento siguen en pie")
    void noDebilitaLasOtrasReglas() {
        assertThatThrownBy(() -> insertarMovimiento("FANTASMA", "Almacen V36", null))
                .as("un tipo inventado sigue sin entrar")
                .hasMessageContaining("chk_movimiento");
        assertThatThrownBy(() -> insertarMovimiento("VENTA", null, "Almacen V36"))
                .as("una salida por venta sigue exigiendo almacén origen")
                .hasMessageContaining("chk_movimiento_almacenes");
        assertThatCode(() -> insertarMovimiento("VENTA", "Almacen V36", null))
                .doesNotThrowAnyException();
    }

    // ── Devolución ───────────────────────────────────────────────────────

    @Test
    @DisplayName("el turno de caja arranca sin devoluciones en efectivo")
    void turnoCajaTraeLaColumnaDeDevoluciones() throws SQLException {
        assertThat(existeColumna("turno_caja", "total_devoluciones_efectivo")).isTrue();
        assertThat(consultarTexto("""
                SELECT column_default FROM information_schema.columns
                WHERE table_name = 'turno_caja' AND column_name = 'total_devoluciones_efectivo'
                """)).contains("0.00");
    }

    @Test
    @DisplayName("la devolución exige referencia de operación única y totales conciliados")
    void restriccionesDeLaDevolucion() throws SQLException {
        assertThat(existeColumna("devolucion", "referencia_operacion")).isTrue();
        assertThat(existeColumna("devolucion", "ncf_afectado")).isTrue();
        assertThat(existeColumna("detalle_devolucion", "base_imponible_acreditada")).isTrue();

        assertThat(consultarTexto("""
                SELECT indexdef FROM pg_indexes
                WHERE tablename = 'devolucion' AND indexname = 'uk_devolucion_referencia'
                """)).contains("UNIQUE");
        assertThat(consultarTexto("""
                SELECT pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conname = 'chk_devolucion_totales'
                """)).contains("base_imponible");
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void insertarResolucion(String tipo, String prefijo) throws SQLException {
        ejecutar("""
                INSERT INTO resolucion_ncf (
                    tipo_ncf, descripcion, numero_resolucion, prefijo,
                    secuencia_inicio, secuencia_final, secuencia_actual,
                    fecha_vencimiento, estado)
                VALUES ('%s', 'Resolucion', 'RES-%s', '%s', 1, 100, 1, '%s', 'INACTIVO')
                """.formatted(tipo, tipo + prefijo, prefijo, LocalDate.now().plusYears(1)));
    }

    private void insertarMovimiento(String tipo, String almacenOrigen, String almacenDestino)
            throws SQLException {
        ejecutar("""
                INSERT INTO movimiento (tipo, id_almacen_origen, id_almacen_destino,
                                        usuario_responsable, fecha_movimiento)
                VALUES ('%s', %s, %s, 'tester', NOW())
                """.formatted(tipo, referenciaAlmacen(almacenOrigen), referenciaAlmacen(almacenDestino)));
    }

    private String referenciaAlmacen(String nombre) {
        return nombre == null
                ? "NULL"
                : "(SELECT id_almacen FROM almacen WHERE nombre = '" + nombre + "')";
    }

    private boolean existeColumna(String tabla, String columna) throws SQLException {
        return consultarTexto("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '%s' AND column_name = '%s'
                """.formatted(tabla, columna)) != null;
    }

    private String consultarTexto(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private void ejecutar(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }
}
