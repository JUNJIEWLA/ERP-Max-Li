package com.maxli.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;
import java.util.Locale;

/**
 * Verifica en el arranque que un despliegue productivo no herede la
 * configuración de desarrollo (ISSUE-010).
 *
 * <p>Es un bean del contexto y no un chequeo suelto: si algo no cumple, la
 * excepción impide que Spring termine de arrancar. Falla cerrado — nunca
 * degrada la seguridad para poder levantar el servicio.
 *
 * <p>Solo se activa con el perfil {@code prod}, de modo que el entorno local
 * sigue funcionando con los valores de ejemplo.
 */
@Configuration
@Profile("prod")
@RequiredArgsConstructor
public class GuardaSeguridadProduccion {

    private final JwtProperties jwtProperties;
    private final CorsProperties corsProperties;

    @PostConstruct
    public void validar() {
        JwtSecretPolicy.validarParaProduccion(jwtProperties.getSecret());
        validarOrigenesCors(corsProperties.getAllowedOrigins());
    }

    /**
     * La API responde con {@code allowCredentials=true} porque la sesión viaja en
     * cookie; un comodín sería inaceptable incluso si el navegador lo admitiera,
     * y un origen en texto plano expondría esa cookie en la red.
     */
    private void validarOrigenesCors(List<String> origenes) {
        if (origenes.isEmpty()) {
            throw new ConfiguracionInseguraException(
                    "CORS_ALLOWED_ORIGINS no está definido. En producción debe listar "
                    + "explícitamente el origen del frontend, por ejemplo "
                    + "https://erp.plazamax.do");
        }

        for (String origen : origenes) {
            if (origen.contains("*")) {
                throw new ConfiguracionInseguraException(
                        "CORS_ALLOWED_ORIGINS contiene un comodín ('" + origen + "'). "
                        + "La sesión viaja en cookie (allowCredentials=true), así que cada "
                        + "origen debe declararse completo.");
            }

            String normalizado = origen.toLowerCase(Locale.ROOT);
            if (!normalizado.startsWith("https://")) {
                throw new ConfiguracionInseguraException(
                        "CORS_ALLOWED_ORIGINS incluye un origen sin HTTPS ('" + origen + "'). "
                        + "En producción la cookie de sesión es Secure y solo viaja cifrada.");
            }
        }
    }
}
