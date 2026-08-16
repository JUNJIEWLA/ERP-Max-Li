package com.maxli.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("V33 — Controles NCF sobre datos existentes")
class V33NcfControlsMigrationTest {

    private EmbeddedPostgres postgres;
    private DataSource dataSource;

    @BeforeEach
    void arrancarPostgresYMigrarHastaV32() throws IOException {
        postgres = EmbeddedPostgres.builder().start();
        dataSource = postgres.getPostgresDatabase();
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("32")
                .load()
                .migrate();
    }

    @AfterEach
    void apagarPostgres() throws IOException {
        postgres.close();
    }

    @Test
    @DisplayName("la migración falla explícitamente si existen dos ACTIVA del mismo tipo")
    void fallaConMensajeAccionableSiHayActivasDuplicadas() throws SQLException {
        insertarResolucion("B02", 1, 10, 1, "ACTIVO");
        insertarResolucion("B02", 11, 20, 11, "ACTIVO");

        assertThatThrownBy(this::completarMigracion)
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("V33")
                .hasMessageContaining("B02")
                .hasMessageContaining("INACTIVO");
    }

    @Test
    @DisplayName("la migración falla explícitamente si existen rangos, estados o prefijos inválidos")
    void fallaConMensajeAccionableSiHayDatosInvalidos() throws SQLException {
        insertarResolucion("B14", 10, 5, 10, "ACTIVO");

        assertThatThrownBy(this::completarMigracion)
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("V33")
                .hasMessageContaining("rangos")
                .hasMessageContaining("corregir");
    }

    private void completarMigracion() {
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    private void insertarResolucion(String tipo, long inicio, long fin, long actual, String estado) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO resolucion_ncf (
                         tipo_ncf, descripcion, numero_resolucion, prefijo,
                         secuencia_inicio, secuencia_final, secuencia_actual,
                         fecha_vencimiento, estado
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     """)) {
            statement.setString(1, tipo);
            statement.setString(2, "Resolucion " + tipo);
            statement.setString(3, "RES-" + tipo + "-" + inicio);
            statement.setString(4, tipo);
            statement.setLong(5, inicio);
            statement.setLong(6, fin);
            statement.setLong(7, actual);
            statement.setObject(8, LocalDate.now().plusDays(30));
            statement.setString(9, estado);
            statement.executeUpdate();
        }
    }
}
