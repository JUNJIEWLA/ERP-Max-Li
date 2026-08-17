package com.maxli.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ISSUE-010 — El despliegue productivo no puede arrancar con un secreto JWT
 * ausente, corto, de baja entropía o heredado de los ejemplos del repositorio.
 */
@DisplayName("JwtSecretPolicy — exigencias del secreto en producción")
class JwtSecretPolicyTest {

    @Test
    @DisplayName("rechaza un secreto ausente")
    void rechazaSecretoAusente() {
        assertThatThrownBy(() -> JwtSecretPolicy.validarParaProduccion(null))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("JWT_SECRET");

        assertThatThrownBy(() -> JwtSecretPolicy.validarParaProduccion("   "))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    @DisplayName("rechaza un secreto por debajo de 256 bits")
    void rechazaSecretoCorto() {
        String corto = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P";  // 31 bytes

        assertThatThrownBy(() -> JwtSecretPolicy.validarParaProduccion(corto))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("256 bits");
    }

    @ParameterizedTest(name = "rechaza el valor de ejemplo: {0}")
    @ValueSource(strings = {
            "maxli-dev-secret-key-minimo-256-bits-no-usar-en-prod",
            "cambia-esto-en-produccion-minimo-256-bits",
            "test-secret-key-minimo-256-bits-para-pruebas-de-integracion-maxli",
            "changeme-changeme-changeme-changeme-changeme",
            "example-secret-value-for-the-maxli-erp-backend-jwt"
    })
    @DisplayName("rechaza los secretos de ejemplo publicados en el repositorio")
    void rechazaSecretosDeEjemplo(String secreto) {
        assertThatThrownBy(() -> JwtSecretPolicy.validarParaProduccion(secreto))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("ejemplo");
    }

    @Test
    @DisplayName("rechaza un secreto largo pero sin entropía")
    void rechazaSecretoSinEntropia() {
        String repetido = "ababababababababababababababababababababababab";

        assertThatThrownBy(() -> JwtSecretPolicy.validarParaProduccion(repetido))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("entropía");
    }

    @Test
    @DisplayName("acepta un secreto aleatorio de longitud suficiente")
    void aceptaSecretoFuerte() {
        String fuerte = "7Qx4Zt1LpV9sRc3HgN8mYbK2wJfD6aTuE5oXiB0nMrSyPl";

        assertThatCode(() -> JwtSecretPolicy.validarParaProduccion(fuerte))
                .doesNotThrowAnyException();
    }
}
