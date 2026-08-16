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
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V30 hace un "mejor esfuerzo" para asignar almacén a cajas ya existentes.
 * <p>
 * Se prueba en aislamiento de la migración (no vía {@link PostgresIntegrationTest},
 * que arranca con el esquema ya migrado hasta la última versión): se levanta un
 * PostgreSQL real, se migra solo hasta V29, se siembran datos previos a V30 y
 * luego se completa la migración, para observar exactamente el "antes/después"
 * del backfill.
 * <p>
 * V19 ya garantiza al menos un almacén ACTIVO ("Almacén Principal") si no
 * existía ninguno, así que al llegar a V29 la tabla {@code almacen} nunca está
 * realmente vacía en una migración real. Los casos "sin ningún almacén" y "un
 * único almacén" de aquí en adelante parten de ese almacén sembrado por V19 (o
 * lo eliminan explícitamente para cubrir el caso límite igual).
 */
@DisplayName("V30 — Backfill de almacén en cajas existentes")
class V30AlmacenBackfillMigrationTest {

    private EmbeddedPostgres postgres;
    private DataSource dataSource;

    @BeforeEach
    void arrancarPostgresYMigrarHastaV29() throws IOException {
        postgres = EmbeddedPostgres.builder().start();
        dataSource = postgres.getPostgresDatabase();
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("29")
                .load()
                .migrate();
    }

    @AfterEach
    void apagarPostgres() throws IOException {
        postgres.close();
    }

    @Test
    @DisplayName("con un único almacén ACTIVO (el sembrado por V19), la caja existente se autoasigna a él")
    void asignaAutomaticamenteCuandoHayUnUnicoAlmacenActivo() throws SQLException {
        Long idAlmacenSembrado = unicoAlmacenExistente();
        Long idCaja = insertarCaja("Caja Sin Almacen");

        completarMigracion();

        assertThat(idAlmacenDeCaja(idCaja)).isEqualTo(idAlmacenSembrado);
    }

    @Test
    @DisplayName("con varios almacenes ACTIVOS, no hay forma de adivinar cuál: queda NULL")
    void dejaNullCuandoHayVariosAlmacenesActivos() throws SQLException {
        // V19 ya sembró un almacén ACTIVO; con este segundo, quedan dos.
        insertarAlmacen("Almacen Adicional", "ACTIVO");
        Long idCaja = insertarCaja("Caja Ambigua");

        completarMigracion();

        assertThat(idAlmacenDeCaja(idCaja)).isNull();
    }

    @Test
    @DisplayName("sin ningún almacén registrado, queda NULL")
    void dejaNullCuandoNoHayNingunAlmacen() throws SQLException {
        // Caso límite: en la práctica V19 siempre deja al menos un almacén,
        // pero el guard de V30 debe seguir siendo seguro si alguna vez no lo hay.
        eliminarTodosLosAlmacenes();
        Long idCaja = insertarCaja("Caja Huerfana");

        completarMigracion();

        assertThat(idAlmacenDeCaja(idCaja)).isNull();
    }

    @Test
    @DisplayName("si el único almacén está INACTIVO, no cuenta como candidato: queda NULL")
    void dejaNullCuandoElUnicoAlmacenEstaInactivo() throws SQLException {
        desactivarTodosLosAlmacenes();
        Long idCaja = insertarCaja("Caja Con Almacen Inactivo");

        completarMigracion();

        assertThat(idAlmacenDeCaja(idCaja)).isNull();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void completarMigracion() {
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    private Long insertarAlmacen(String nombre, String estado) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO almacen (nombre, estado) VALUES (?, ?) RETURNING id_almacen")) {
            statement.setString(1, nombre);
            statement.setString(2, estado);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private Long unicoAlmacenExistente() throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT id_almacen FROM almacen")) {
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private void eliminarTodosLosAlmacenes() throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM almacen");
        }
    }

    private void desactivarTodosLosAlmacenes() throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("UPDATE almacen SET estado = 'INACTIVO'");
        }
    }

    private Long insertarCaja(String nombre) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO caja (nombre) VALUES (?) RETURNING id_caja")) {
            statement.setString(1, nombre);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private Long idAlmacenDeCaja(Long idCaja) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT id_almacen FROM caja WHERE id_caja = ?")) {
            statement.setLong(1, idCaja);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                long value = resultSet.getLong(1);
                return resultSet.wasNull() ? null : value;
            }
        }
    }
}
