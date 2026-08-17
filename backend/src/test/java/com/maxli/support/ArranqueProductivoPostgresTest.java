package com.maxli.support;

import com.maxli.MaxLiApplication;
import com.maxli.auth.service.AdminBootstrapService;
import com.maxli.config.ConfiguracionInseguraException;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Arranque <b>completo</b> con el perfil {@code prod} contra un PostgreSQL real.
 *
 * <p>Las pruebas de {@code ArranqueProduccionTest} montan solo los beans de
 * configuración, así que no dirían nada si el contrato de base de datos
 * estuviera mal cableado ni si un {@code ApplicationRunner} fallara. Aquí se
 * levanta la aplicación entera —Flyway, JPA, seguridad y el bootstrap del
 * administrador— del mismo modo que en un despliegue.
 *
 * <p>Cubre en particular que {@code DB_URL} / {@code DB_USER} /
 * {@code DB_PASSWORD} lleguen de verdad a {@code spring.datasource}: estaban
 * documentadas pero no cableadas, así que un despliegue productivo no habría
 * encontrado la base.
 */
@DisplayName("Arranque productivo completo sobre PostgreSQL")
class ArranqueProductivoPostgresTest {

    private static final String SECRETO_FUERTE =
            "7Qx4Zt1LpV9sRc3HgN8mYbK2wJfD6aTuE5oXiB0nMrSyPl";
    private static final String CLAVE_BOOTSTRAP = "Piloto#MaxLi2026";

    private static EmbeddedPostgres postgres;

    @BeforeAll
    static void arrancarPostgres() throws IOException {
        postgres = EmbeddedPostgres.builder().start();
    }

    @AfterAll
    static void apagarPostgres() throws IOException {
        if (postgres != null) {
            postgres.close();
        }
    }

    @Test
    @DisplayName("arranca de punta a punta y deja la credencial inicial utilizable")
    void arrancaConContratoCompleto() throws SQLException {
        try (ConfigurableApplicationContext contexto = arrancar(
                "DB_URL=" + jdbcUrl("prod_ok"),
                "DB_USER=postgres",
                "DB_PASSWORD=postgres",
                "JWT_SECRET=" + SECRETO_FUERTE,
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=" + CLAVE_BOOTSTRAP)) {

            assertThat(contexto.isRunning()).isTrue();

            // La base la resolvió el contrato DB_*, no un valor por defecto.
            DataSource dataSource = contexto.getBean(DataSource.class);
            try (Connection conexion = dataSource.getConnection()) {
                assertThat(conexion.getMetaData().getURL()).contains("prod_ok");
            }

            PasswordEncoder encoder = contexto.getBean(PasswordEncoder.class);
            Admin admin = leerAdmin(dataSource);

            assertThat(encoder.matches(CLAVE_BOOTSTRAP, admin.passwordHash()))
                    .as("el bootstrap debe dejar la credencial inicial utilizable")
                    .isTrue();
            assertThat(encoder.matches("Admin@2026", admin.passwordHash()))
                    .as("la credencial publicada no puede seguir sirviendo")
                    .isFalse();
            assertThat(admin.requiereCambioPassword()).isTrue();
        }
    }

    @Test
    @DisplayName("sin perfil declarado no arranca, y lo dice con un mensaje operativo")
    void sinPerfilNoArranca() {
        assertThatThrownBy(() -> new SpringApplicationBuilder(MaxLiApplication.class)
                .web(WebApplicationType.NONE)
                .properties(
                        "DB_URL=" + jdbcUrl("prod_sin_perfil"),
                        "DB_USER=postgres",
                        "DB_PASSWORD=postgres")
                .run()
                .close())
                .satisfies(fallo -> assertThat(causaRaiz(fallo))
                        // Sin esto el arranque también fallaba, pero con un
                        // WeakKeyException sobre un secreto vacío: un error de
                        // criptografía en lugar de «declare el perfil».
                        .isInstanceOf(ConfiguracionInseguraException.class)
                        .hasMessageContaining("SPRING_PROFILES_ACTIVE"));
    }

    @Test
    @DisplayName("no arranca sin base de datos declarada")
    void noArrancaSinBaseDeDatos() {
        assertThatThrownBy(() -> arrancar(
                "DB_URL=",
                "DB_USER=",
                "DB_PASSWORD=",
                "JWT_SECRET=" + SECRETO_FUERTE,
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=" + CLAVE_BOOTSTRAP).close())
                .isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("no arranca con el secreto de ejemplo, aunque la base esté bien")
    void noArrancaConSecretoDeEjemplo() {
        assertThatThrownBy(() -> arrancar(
                "DB_URL=" + jdbcUrl("prod_secreto"),
                "DB_USER=postgres",
                "DB_PASSWORD=postgres",
                "JWT_SECRET=maxli-dev-secret-key-minimo-256-bits-no-usar-en-prod",
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=" + CLAVE_BOOTSTRAP).close())
                .satisfies(fallo -> assertThat(causaRaiz(fallo))
                        .isInstanceOf(ConfiguracionInseguraException.class));
    }

    @Test
    @DisplayName("no arranca si la base necesita bootstrap y no hay credencial segura")
    void noArrancaSinCredencialDeBootstrap() throws SQLException {
        assertThatThrownBy(() -> arrancar(
                "DB_URL=" + jdbcUrl("prod_sin_bootstrap"),
                "DB_USER=postgres",
                "DB_PASSWORD=postgres",
                "JWT_SECRET=" + SECRETO_FUERTE,
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=").close())
                .satisfies(fallo -> assertThat(causaRaiz(fallo))
                        .isInstanceOf(ConfiguracionInseguraException.class)
                        .hasMessageContaining("BOOTSTRAP_ADMIN_PASSWORD"));

        // Y la cuenta queda bloqueada, no con la credencial publicada.
        assertThat(leerAdmin(postgres.getDatabase("postgres", "prod_sin_bootstrap")).passwordHash())
                .isEqualTo(AdminBootstrapService.CENTINELA_BLOQUEADO);
    }

    @Test
    @DisplayName("el segundo arranque no vuelve a tocar la contraseña del administrador")
    void elSegundoArranqueNoResetea() throws SQLException {
        String url = jdbcUrl("prod_dos_arranques");

        try (ConfigurableApplicationContext primero = arrancar(
                "DB_URL=" + url, "DB_USER=postgres", "DB_PASSWORD=postgres",
                "JWT_SECRET=" + SECRETO_FUERTE,
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=" + CLAVE_BOOTSTRAP)) {
            assertThat(primero.isRunning()).isTrue();
        }

        DataSource dataSource = postgres.getDatabase("postgres", "prod_dos_arranques");
        // El administrador elige su propia contraseña tras el primer ingreso.
        String hashElegido = "$2a$10$P2eUvGQ1oi5aRUJ5uGZ7ZuqxG5aXvNbxk6VvJhQ1Sd8t3nMkLpQyW";
        ejecutar(dataSource, "UPDATE usuario SET password_hash = '" + hashElegido
                             + "', requiere_cambio_password = false WHERE username = 'admin'");

        try (ConfigurableApplicationContext segundo = arrancar(
                "DB_URL=" + url, "DB_USER=postgres", "DB_PASSWORD=postgres",
                "JWT_SECRET=" + SECRETO_FUERTE,
                "CORS_ALLOWED_ORIGINS=https://erp.plazamax.do",
                "BOOTSTRAP_ADMIN_PASSWORD=" + CLAVE_BOOTSTRAP)) {
            assertThat(segundo.isRunning()).isTrue();
        }

        assertThat(leerAdmin(dataSource).passwordHash())
                .as("un reinicio con la variable aún definida no puede pisar la contraseña elegida")
                .isEqualTo(hashElegido);
    }

    // ── Infraestructura ──────────────────────────────────────────────────

    /** Arranca la aplicación real con el perfil prod y las variables dadas. */
    private ConfigurableApplicationContext arrancar(String... propiedades) {
        return new SpringApplicationBuilder(MaxLiApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .properties(propiedades)
                .run();
    }

    private String jdbcUrl(String base) {
        crearBase(base);
        return "jdbc:postgresql://localhost:" + postgres.getPort() + "/" + base;
    }

    private void crearBase(String nombre) {
        try (Connection conexion = postgres.getPostgresDatabase().getConnection();
             PreparedStatement sentencia = conexion.prepareStatement("CREATE DATABASE " + nombre)) {
            sentencia.executeUpdate();
        } catch (SQLException e) {
            // Ya existía: las pruebas pueden compartir la instancia.
        }
    }

    private void ejecutar(DataSource dataSource, String sql) throws SQLException {
        try (Connection conexion = dataSource.getConnection();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.executeUpdate();
        }
    }

    private Admin leerAdmin(DataSource dataSource) throws SQLException {
        try (Connection conexion = dataSource.getConnection();
             PreparedStatement sentencia = conexion.prepareStatement(
                     "SELECT password_hash, requiere_cambio_password "
                     + "FROM usuario WHERE username = 'admin'")) {
            try (ResultSet fila = sentencia.executeQuery()) {
                assertThat(fila.next()).as("debe existir el usuario admin").isTrue();
                return new Admin(fila.getString(1), fila.getBoolean(2));
            }
        }
    }

    private record Admin(String passwordHash, boolean requiereCambioPassword) {
    }

    /**
     * El guard puede propagarse tal cual o envuelto por Spring según la fase del
     * arranque en que salte, así que se recorre la cadena en vez de asumir una
     * profundidad concreta.
     */
    private static Throwable causaRaiz(Throwable fallo) {
        Throwable actual = fallo;
        while (actual != null
                && !(actual instanceof ConfiguracionInseguraException)
                && actual.getCause() != null
                && actual.getCause() != actual) {
            actual = actual.getCause();
        }
        return actual;
    }
}
