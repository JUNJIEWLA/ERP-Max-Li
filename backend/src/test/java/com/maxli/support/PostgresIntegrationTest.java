package com.maxli.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * Base para pruebas de integración contra un PostgreSQL <b>real</b>.
 * <p>
 * Levanta una instancia embebida (binarios oficiales de PostgreSQL, sin Docker)
 * una sola vez por JVM y apunta el datasource de Spring hacia ella; Flyway
 * ejecuta las migraciones reales del proyecto sobre esa base.
 * <p>
 * Hace falta una base de verdad — no H2 ni un mock — porque lo que se valida es
 * la semántica de bloqueo de filas de PostgreSQL ({@code SELECT ... FOR UPDATE}),
 * que ningún motor embebido en memoria reproduce.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class PostgresIntegrationTest {

    private static final EmbeddedPostgres POSTGRES = arrancar();

    private static EmbeddedPostgres arrancar() {
        try {
            EmbeddedPostgres instancia = EmbeddedPostgres.builder().start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    instancia.close();
                } catch (IOException ignored) {
                    // La JVM está terminando; no hay nada que recuperar.
                }
            }));
            return instancia;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo arrancar el PostgreSQL embebido de pruebas", e);
        }
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",
                () -> "jdbc:postgresql://localhost:" + POSTGRES.getPort() + "/postgres");
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}
