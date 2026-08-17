package com.maxli.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
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
 * ISSUE-010 — V35 debe dejar inutilizable la credencial {@code admin / Admin@2026}
 * tanto en una instalación nueva como al actualizar una base ya existente, sin
 * pisar la contraseña de quien ya la hubiera rotado.
 */
@DisplayName("V35 — bloqueo de la credencial administrativa publicada")
class V35BloqueoAdminMigrationTest {

    /** Hash BCrypt de Admin@2026 publicado en V8. */
    private static final String HASH_PUBLICADO =
            "$2a$10$oqR3egEbQrfRrMPrvtdIueqhTImOq5Ix/U67c2rP3TzOFrcO2MvJ2";

    private static final String CENTINELA = "LOCKED::BOOTSTRAP_ADMIN_PASSWORD";

    private EmbeddedPostgres postgres;
    private DataSource dataSource;

    @AfterEach
    void apagarPostgres() throws IOException {
        if (postgres != null) {
            postgres.close();
        }
    }

    @Test
    @DisplayName("instalación nueva: el admin no queda con la contraseña publicada")
    void instalacionNuevaNoDejaCredencialConocida() throws Exception {
        arrancarPostgres();
        migrarHasta(null);   // todas las migraciones, incluida V35

        Admin admin = leerAdmin();
        assertThat(admin.passwordHash)
                .as("una base recién creada no puede quedar con el hash publicado")
                .isNotEqualTo(HASH_PUBLICADO)
                .isEqualTo(CENTINELA);
        assertThat(admin.requiereCambioPassword)
                .as("V21 lo había puesto en false; V35 debe volver a exigirlo")
                .isTrue();
    }

    @Test
    @DisplayName("actualización del esquema anterior: bloquea al admin que aún tiene la clave publicada")
    void actualizacionBloqueaCredencialHeredada() throws Exception {
        arrancarPostgres();
        migrarHasta("34");

        // Estado exacto que dejaban V8 + V21 en una base ya desplegada.
        assertThat(leerAdmin().passwordHash).isEqualTo(HASH_PUBLICADO);
        assertThat(leerAdmin().requiereCambioPassword).isFalse();
        ejecutar("UPDATE usuario SET token_version = 4 WHERE username = 'admin'");

        migrarHasta(null);

        Admin admin = leerAdmin();
        assertThat(admin.passwordHash).isEqualTo(CENTINELA);
        assertThat(admin.requiereCambioPassword).isTrue();
        assertThat(admin.tokenVersion)
                .as("las sesiones emitidas con la credencial conocida deben invalidarse")
                .isEqualTo(5);
    }

    @Test
    @DisplayName("actualización: no toca al admin cuya contraseña ya fue rotada")
    void actualizacionRespetaContrasenaYaRotada() throws Exception {
        arrancarPostgres();
        migrarHasta("34");

        String hashPropio = "$2a$10$P2eUvGQ1oi5aRUJ5uGZ7ZuqxG5aXvNbxk6VvJhQ1Sd8t3nMkLpQyW";
        ejecutar("UPDATE usuario SET password_hash = '" + hashPropio + "', token_version = 7 "
                 + "WHERE username = 'admin'");

        migrarHasta(null);

        Admin admin = leerAdmin();
        assertThat(admin.passwordHash)
                .as("una contraseña ya elegida por el cliente no puede perderse")
                .isEqualTo(hashPropio);
        assertThat(admin.tokenVersion)
                .as("tampoco deben invalidarse sus sesiones")
                .isEqualTo(7);
    }

    // ── Infraestructura ──────────────────────────────────────────────────

    private void arrancarPostgres() throws IOException {
        postgres = EmbeddedPostgres.builder().start();
        dataSource = postgres.getPostgresDatabase();
    }

    private void migrarHasta(String objetivo) {
        var configuracion = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration");
        if (objetivo != null) {
            configuracion.target(objetivo);
        }
        configuracion.load().migrate();
    }

    private void ejecutar(String sql) throws SQLException {
        try (Connection conexion = dataSource.getConnection();
             Statement sentencia = conexion.createStatement()) {
            sentencia.executeUpdate(sql);
        }
    }

    private Admin leerAdmin() throws SQLException {
        try (Connection conexion = dataSource.getConnection();
             PreparedStatement sentencia = conexion.prepareStatement(
                     "SELECT password_hash, requiere_cambio_password, token_version "
                     + "FROM usuario WHERE username = 'admin'")) {
            try (ResultSet fila = sentencia.executeQuery()) {
                assertThat(fila.next()).as("debe existir el usuario admin").isTrue();
                return new Admin(fila.getString(1), fila.getBoolean(2), fila.getInt(3));
            }
        }
    }

    private record Admin(String passwordHash, boolean requiereCambioPassword, int tokenVersion) {
    }
}
