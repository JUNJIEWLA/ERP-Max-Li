package com.maxli.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * El perfil dejó de activarse solo.
 *
 * <p>Antes {@code application.yml} traía {@code active: ${SPRING_PROFILES_ACTIVE:dev}}:
 * un despliegue que olvidara declarar el perfil arrancaba en <b>dev</b>, es
 * decir con el secreto JWT de ejemplo, CORS a localhost, sin exigir HTTPS y sin
 * la cookie {@code Secure} — y sin que nada lo advirtiera. El modo más
 * permisivo no puede ser el que se obtiene por descuido.
 *
 * <p>El arranque real que aplica esta política se comprueba en
 * {@code ArranqueProductivoPostgresTest}.
 */
@DisplayName("Perfil de ejecución — debe elegirse explícitamente")
class PerfilObligatorioTest {

    @Test
    @DisplayName("sin perfil declarado falla cerrado")
    void sinPerfilFalla() {
        assertThatThrownBy(() -> PerfilPolicy.validar())
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE");
    }

    @Test
    @DisplayName("una lista vacía o en blanco cuenta como ausencia de perfil")
    void perfilEnBlancoFalla() {
        assertThatThrownBy(() -> PerfilPolicy.validar("", "   "))
                .isInstanceOf(ConfiguracionInseguraException.class);
    }

    @Test
    @DisplayName("el mensaje enumera los perfiles válidos, no deja adivinar")
    void elMensajeEsOperativo() {
        assertThatThrownBy(() -> PerfilPolicy.validar())
                .hasMessageContaining("dev")
                .hasMessageContaining("prod");
    }

    @Test
    @DisplayName("un perfil desconocido tampoco vale")
    void perfilDesconocidoFalla() {
        assertThatThrownBy(() -> PerfilPolicy.validar("staging"))
                .isInstanceOf(ConfiguracionInseguraException.class);
    }

    @Test
    @DisplayName("declarar dev y prod a la vez es una contradicción")
    void devYProdALaVezFalla() {
        assertThatThrownBy(() -> PerfilPolicy.validar("dev", "prod"))
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("más de un perfil");
    }

    @Test
    @DisplayName("dev, prod y test son válidos por separado")
    void losPerfilesConocidosValen() {
        assertThatCode(() -> PerfilPolicy.validar("dev")).doesNotThrowAnyException();
        assertThatCode(() -> PerfilPolicy.validar("prod")).doesNotThrowAnyException();
        assertThatCode(() -> PerfilPolicy.validar("test")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("el nombre del perfil no distingue mayúsculas")
    void elNombreNoDistingueMayusculas() {
        assertThatCode(() -> PerfilPolicy.validar("PROD")).doesNotThrowAnyException();
    }
}
