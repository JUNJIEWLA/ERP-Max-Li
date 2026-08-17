package com.maxli.config;

import com.maxli.support.PostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ISSUE-015 — Contrato de healthcheck del piloto.
 *
 * <p>El proxy y quien opere el despliegue necesitan tres sondas y nada más:
 * {@code /actuator/health}, {@code /actuator/health/liveness} y
 * {@code /actuator/health/readiness}. Deben responder sin autenticación —el
 * proxy no tiene sesión— y sin revelar componentes, versiones, rutas ni
 * credenciales. Cualquier otro endpoint de Actuator debe quedar inalcanzable.
 *
 * <p>Se levanta la aplicación completa contra un PostgreSQL real
 * ({@link PostgresIntegrationTest}) porque la sonda de readiness solo significa
 * algo si de verdad consulta la base.
 *
 * <p>El perfil {@code test} hereda {@code require-https=true}, que es lo que
 * corre en producción, así que las peticiones viajan con
 * {@code X-Forwarded-Proto: https} igual que las reenviaría el reverse proxy.
 * Eso deja probado de paso el contrato documentado en el runbook.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "server.forward-headers-strategy=framework")
@DisplayName("Healthchecks del piloto — exposición mínima y sin detalles")
class HealthchecksPilotoTest extends PostgresIntegrationTest {

    @Autowired private TestRestTemplate cliente;
    @LocalServerPort private int puerto;

    // ── Las tres sondas son públicas y responden UP ───────────────────────

    @Test
    @DisplayName("/actuator/health responde UP sin autenticación")
    void healthEsPublicoYResponde() {
        ResponseEntity<String> respuesta = sondear("/actuator/health");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(respuesta.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    @DisplayName("/actuator/health/liveness responde UP sin autenticación")
    void livenessEsPublicoYResponde() {
        ResponseEntity<String> respuesta = sondear("/actuator/health/liveness");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(respuesta.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    @DisplayName("/actuator/health/readiness responde UP con PostgreSQL disponible")
    void readinessConfirmaLaBaseDeDatos() {
        ResponseEntity<String> respuesta = sondear("/actuator/health/readiness");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(respuesta.getBody()).contains("\"status\":\"UP\"");
    }

    // ── Ninguna de las tres revela información operativa ──────────────────

    @ParameterizedTest(name = "{0} no revela detalles")
    @ValueSource(strings = {
            "/actuator/health",
            "/actuator/health/liveness",
            "/actuator/health/readiness"})
    @DisplayName("las sondas devuelven solo el estado, sin componentes ni datos de conexión")
    void lasSondasNoRevelanDetalles(String ruta) {
        String cuerpo = sondear(ruta).getBody();

        // El cuerpo es exactamente el estado: cualquier añadido sería
        // inventario gratis para quien sondee el endpoint sin credenciales.
        assertThat(cuerpo).isEqualTo("{\"status\":\"UP\"}");
        assertThat(cuerpo)
                .doesNotContainIgnoringCase("components")
                .doesNotContainIgnoringCase("details")
                .doesNotContainIgnoringCase("postgres")
                .doesNotContainIgnoringCase("jdbc")
                .doesNotContainIgnoringCase("diskSpace")
                .doesNotContainIgnoringCase("version");
    }

    // ── Todo lo demás de Actuator queda fuera del alcance del piloto ──────

    @ParameterizedTest(name = "{0} no es alcanzable")
    @ValueSource(strings = {
            "/actuator",
            "/actuator/health/db",
            "/actuator/info",
            "/actuator/env",
            "/actuator/beans",
            "/actuator/metrics",
            "/actuator/loggers",
            "/actuator/mappings",
            "/actuator/configprops",
            "/actuator/threaddump",
            "/actuator/heapdump"})
    @DisplayName("cualquier otro endpoint de Actuator queda inalcanzable")
    void elRestoDeActuatorNoSeExpone(String ruta) {
        ResponseEntity<String> respuesta = sondear(ruta);

        assertThat(respuesta.getStatusCode().is2xxSuccessful())
                .as("%s no debe responder contenido", ruta)
                .isFalse();
        assertThat(respuesta.getStatusCode())
                .as("%s debe quedar denegado o inexistente, nunca redirigido a otra cosa", ruta)
                .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND);
    }

    // ── El contrato HTTPS de producción sigue vigente sobre las sondas ────

    @Test
    @DisplayName("una sonda en texto plano se redirige a https, como el resto de la aplicación")
    void laSondaEnTextoPlanoSeRedirigeAHttps() throws IOException {
        // Conexión cruda y sin seguir redirecciones: seguirlas llevaría a un
        // https://localhost:<puerto> que en pruebas no habla TLS, y el cliente
        // rebotaría en bucle en lugar de dejar ver la respuesta que interesa.
        HttpURLConnection conexion = (HttpURLConnection)
                URI.create("http://localhost:" + puerto + "/actuator/health").toURL().openConnection();
        conexion.setInstanceFollowRedirects(false);
        try {
            // Lo que importa es que la sonda no se atienda en claro. El esquema
            // exacto del Location depende del mapeo de puertos del despliegue
            // (8080→8443), que aquí es un puerto aleatorio; ese detalle ya lo
            // cubre TransporteHttpsProduccionTest.
            assertThat(conexion.getResponseCode())
                    .as("el piloto no atiende tráfico en claro; el proxy debe enviar "
                        + "X-Forwarded-Proto: https o consultar por https")
                    .isBetween(300, 399);
            assertThat(conexion.getHeaderField(HttpHeaders.LOCATION))
                    .as("debe redirigir a la propia sonda, no servirla")
                    .endsWith("/actuator/health");
        } finally {
            conexion.disconnect();
        }
    }

    // ── Infraestructura ──────────────────────────────────────────────────

    /** Sondea como lo haría el reverse proxy: sin sesión y declarando el TLS que él terminó. */
    private ResponseEntity<String> sondear(String ruta) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.add("X-Forwarded-Proto", "https");
        return cliente.exchange(
                "http://localhost:" + puerto + ruta,
                HttpMethod.GET,
                new HttpEntity<>(cabeceras),
                String.class);
    }
}
