package com.maxli.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ISSUE-010 — Con el perfil {@code prod} activo el contexto debe negarse a
 * arrancar si los secretos o el CORS no son aptos para un despliegue real.
 * El guard vive en el contexto, así que la comprobación es de arranque real
 * y no una validación que alguien pueda olvidar invocar.
 */
@DisplayName("Arranque en producción — falla cerrado ante configuración insegura")
class ArranqueProduccionTest {

    private static final String SECRETO_FUERTE =
            "7Qx4Zt1LpV9sRc3HgN8mYbK2wJfD6aTuE5oXiB0nMrSyPl";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(GuardSecurityConfiguration.class)
            .withPropertyValues("spring.profiles.active=prod");

    @Test
    @DisplayName("no arranca sin JWT_SECRET")
    void noArrancaSinSecreto() {
        runner.withPropertyValues(
                        "jwt.secret=",
                        "cors.allowed-origins=https://erp.plazamax.do")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("JWT_SECRET");
                });
    }

    @Test
    @DisplayName("no arranca con el secreto de ejemplo del repositorio")
    void noArrancaConSecretoDeEjemplo() {
        runner.withPropertyValues(
                        "jwt.secret=maxli-dev-secret-key-minimo-256-bits-no-usar-en-prod",
                        "cors.allowed-origins=https://erp.plazamax.do")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("ejemplo");
                });
    }

    @Test
    @DisplayName("no arranca con un secreto por debajo de 256 bits")
    void noArrancaConSecretoDebil() {
        runner.withPropertyValues(
                        "jwt.secret=a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P",
                        "cors.allowed-origins=https://erp.plazamax.do")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("256 bits");
                });
    }

    @Test
    @DisplayName("no arranca sin orígenes CORS explícitos")
    void noArrancaSinOrigenesCors() {
        runner.withPropertyValues(
                        "jwt.secret=" + SECRETO_FUERTE,
                        "cors.allowed-origins=")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("CORS_ALLOWED_ORIGINS");
                });
    }

    @Test
    @DisplayName("no arranca con comodín en CORS porque las credenciales viajan en cookie")
    void noArrancaConComodinCors() {
        runner.withPropertyValues(
                        "jwt.secret=" + SECRETO_FUERTE,
                        "cors.allowed-origins=*")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("comodín");
                });
    }

    @Test
    @DisplayName("no arranca con orígenes CORS en texto plano (http) fuera de localhost")
    void noArrancaConOrigenHttpEnProduccion() {
        runner.withPropertyValues(
                        "jwt.secret=" + SECRETO_FUERTE,
                        "cors.allowed-origins=http://erp.plazamax.do")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(causaRaiz(context.getStartupFailure()))
                            .isInstanceOf(ConfiguracionInseguraException.class)
                            .hasMessageContaining("HTTPS");
                });
    }

    @Test
    @DisplayName("arranca con una configuración productiva válida")
    void arrancaConConfiguracionValida() {
        runner.withPropertyValues(
                        "jwt.secret=" + SECRETO_FUERTE,
                        "cors.allowed-origins=https://erp.plazamax.do,https://caja.plazamax.do")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(CorsProperties.class).getAllowedOrigins())
                            .containsExactly("https://erp.plazamax.do", "https://caja.plazamax.do");
                });
    }

    @Test
    @DisplayName("fuera de producción no impone la política (dev sigue usable)")
    void enDesarrolloNoImponePolitica() {
        new ApplicationContextRunner()
                .withUserConfiguration(GuardSecurityConfiguration.class)
                .withPropertyValues(
                        "spring.profiles.active=dev",
                        "jwt.secret=maxli-dev-secret-key-minimo-256-bits-no-usar-en-prod",
                        "cors.allowed-origins=http://localhost:5173")
                .run(context -> assertThat(context).hasNotFailed());
    }

    /** Desenvuelve la excepción de binding/creación de bean hasta la causa de dominio. */
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

    /** Solo las piezas de configuración que participan en el arranque seguro. */
    @org.springframework.context.annotation.Configuration
    @org.springframework.boot.context.properties.EnableConfigurationProperties({
            JwtProperties.class, CorsProperties.class, LoginProtectionProperties.class})
    @org.springframework.context.annotation.Import(GuardaSeguridadProduccion.class)
    static class GuardSecurityConfiguration {
    }
}
