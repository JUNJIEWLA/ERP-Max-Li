package com.maxli.config;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Exige que el perfil de ejecución se declare a propósito (ISSUE-010).
 *
 * <p>{@code application.yml} traía {@code active: ${SPRING_PROFILES_ACTIVE:dev}}.
 * Un despliegue que olvidara declarar el perfil arrancaba en <b>dev</b>: secreto
 * JWT de ejemplo, CORS a localhost, sin exigir HTTPS y sin cookie {@code Secure},
 * sin una sola advertencia. El modo más permisivo no puede ser el que se obtiene
 * por descuido.
 *
 * <p>Exige además <b>exactamente uno</b>: declarar {@code dev} y {@code prod} a
 * la vez deja la configuración efectiva a merced del orden de precedencia entre
 * documentos.
 */
public final class PerfilPolicy {

    /** Perfiles con configuración propia en el proyecto. */
    public static final List<String> PERFILES_VALIDOS = List.of("dev", "prod", "test");

    private PerfilPolicy() {
    }

    /**
     * @throws ConfiguracionInseguraException si no hay exactamente un perfil
     *         conocido entre los activos.
     */
    public static void validar(String... perfilesActivos) {
        List<String> declarados = Arrays.stream(perfilesActivos == null ? new String[0] : perfilesActivos)
                .filter(perfil -> perfil != null && !perfil.isBlank())
                .map(perfil -> perfil.trim().toLowerCase(Locale.ROOT))
                .filter(PERFILES_VALIDOS::contains)
                .distinct()
                .toList();

        if (declarados.isEmpty()) {
            throw new ConfiguracionInseguraException(
                    "No hay un perfil de ejecución declarado. Defina SPRING_PROFILES_ACTIVE "
                    + "con uno de " + PERFILES_VALIDOS + ". No existe valor por defecto a "
                    + "propósito: arrancar en 'dev' sin pedirlo dejaría el despliegue con el "
                    + "secreto de ejemplo, CORS a localhost y sin HTTPS.");
        }

        if (declarados.size() > 1) {
            throw new ConfiguracionInseguraException(
                    "Hay más de un perfil de ejecución activo " + declarados
                    + ". Declare exactamente uno en SPRING_PROFILES_ACTIVE: combinarlos deja la "
                    + "configuración efectiva a merced del orden de precedencia.");
        }
    }
}
