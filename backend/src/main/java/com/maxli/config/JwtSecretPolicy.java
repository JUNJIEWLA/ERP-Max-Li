package com.maxli.config;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * Política del secreto de firma JWT para despliegues productivos (ISSUE-010).
 *
 * <p>Antes, la aplicación arrancaba con el secreto de desarrollo publicado en el
 * repositorio si {@code JWT_SECRET} no estaba definido; cualquiera con acceso al
 * código podía firmar tokens válidos. Esta clase concentra las tres condiciones
 * que hacen inservible un secreto y se aplica en el arranque de producción.
 *
 * <p>Ningún mensaje de error incluye el secreto observado.
 */
public final class JwtSecretPolicy {

    /** HS256 exige una clave de al menos 256 bits. */
    public static final int LONGITUD_MINIMA_BYTES = 32;

    /** Mínimo de caracteres distintos exigidos; descarta relleno tipo "ababab...". */
    private static final int CARACTERES_DISTINTOS_MINIMOS = 12;

    /**
     * Fragmentos presentes en los valores de ejemplo del repositorio y en los
     * marcadores habituales. Un secreto generado al azar no los contiene.
     */
    private static final List<String> MARCADORES_DE_EJEMPLO = List.of(
            "maxli-dev-secret",
            "cambia-esto",
            "cambiar",
            "changeme",
            "change-me",
            "example",
            "ejemplo",
            "placeholder",
            "no-usar-en-prod",
            "test-secret",
            "dev-secret",
            "secret-key",
            "your-secret",
            "default-secret"
    );

    private JwtSecretPolicy() {
    }

    /**
     * Verifica que el secreto sea apto para producción.
     *
     * @throws ConfiguracionInseguraException si falta, es corto, es un valor de
     *         ejemplo conocido o carece de entropía suficiente.
     */
    public static void validarParaProduccion(String secreto) {
        if (secreto == null || secreto.isBlank()) {
            throw new ConfiguracionInseguraException(
                    "JWT_SECRET no está definido. En producción es obligatorio; "
                    + "genere uno con: openssl rand -base64 48");
        }

        String valor = secreto.trim();

        int bytes = valor.getBytes(StandardCharsets.UTF_8).length;
        if (bytes < LONGITUD_MINIMA_BYTES) {
            throw new ConfiguracionInseguraException(
                    "JWT_SECRET es demasiado corto: se exigen al menos " + LONGITUD_MINIMA_BYTES
                    + " bytes (256 bits) y el valor configurado tiene " + bytes + ". "
                    + "Genere uno con: openssl rand -base64 48");
        }

        String normalizado = valor.toLowerCase(Locale.ROOT);
        for (String marcador : MARCADORES_DE_EJEMPLO) {
            if (normalizado.contains(marcador)) {
                throw new ConfiguracionInseguraException(
                        "JWT_SECRET conserva un valor de ejemplo del repositorio (contiene '"
                        + marcador + "'). Genere un secreto propio con: openssl rand -base64 48");
            }
        }

        if (valor.chars().distinct().count() < CARACTERES_DISTINTOS_MINIMOS) {
            throw new ConfiguracionInseguraException(
                    "JWT_SECRET tiene entropía insuficiente: menos de "
                    + CARACTERES_DISTINTOS_MINIMOS + " caracteres distintos. "
                    + "Genere uno con: openssl rand -base64 48");
        }
    }
}
