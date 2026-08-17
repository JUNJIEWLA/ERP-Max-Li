package com.maxli.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.time.Duration;
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

    /**
     * Techo de vigencia del token. Un JWT no se puede revocar sin consultar la
     * base: cuanto más dura, más vale robarlo. Un día es el máximo defendible
     * para un piloto, y el valor de trabajo son 8 h.
     */
    static final Duration EXPIRACION_MAXIMA = Duration.ofHours(24);

    /** Por debajo de esto la configuración es casi con seguridad un error de unidades. */
    static final Duration EXPIRACION_MINIMA = Duration.ofMinutes(1);

    private static final List<String> SAME_SITE_VALIDOS = List.of("lax", "strict", "none");

    private final JwtProperties jwtProperties;
    private final CorsProperties corsProperties;
    private final SecurityProperties securityProperties;

    @PostConstruct
    public void validar() {
        JwtSecretPolicy.validarParaProduccion(jwtProperties.getSecret());
        validarExpiracion(jwtProperties.getExpiration());
        validarOrigenesCors(corsProperties.getAllowedOrigins());
        validarTransporte();
        validarCookie();
    }

    /**
     * El valor debe ser positivo y razonable. Un 0 o un negativo emitiría tokens
     * ya vencidos; un mes de vigencia convierte cualquier fuga en acceso
     * indefinido.
     */
    private void validarExpiracion(Duration expiracion) {
        if (expiracion == null || expiracion.isZero() || expiracion.isNegative()) {
            throw new ConfiguracionInseguraException(
                    "JWT_EXPIRATION debe ser una duración positiva. Valor recomendado: 8h.");
        }
        if (expiracion.compareTo(EXPIRACION_MINIMA) < 0) {
            throw new ConfiguracionInseguraException(
                    "JWT_EXPIRATION es de menos de un minuto (" + expiracion + "). "
                    + "Compruebe las unidades: se interpreta en milisegundos si no lleva "
                    + "sufijo. Valor recomendado: 8h.");
        }
        if (expiracion.compareTo(EXPIRACION_MAXIMA) > 0) {
            throw new ConfiguracionInseguraException(
                    "JWT_EXPIRATION supera el máximo admitido de " + EXPIRACION_MAXIMA
                    + " (configurado: " + expiracion + "). Un token no se revoca sin consultar "
                    + "la base, así que su vigencia es la ventana de un robo. Valor "
                    + "recomendado: 8h.");
        }
    }

    /** En producción no se atiende nada en texto plano. */
    private void validarTransporte() {
        if (!securityProperties.isRequireHttps()) {
            throw new ConfiguracionInseguraException(
                    "maxli.security.require-https está desactivado. En producción se exige "
                    + "HTTPS: la cookie de sesión y las credenciales no pueden viajar en "
                    + "texto plano.");
        }
    }

    private void validarCookie() {
        SecurityProperties.Cookie cookie = securityProperties.getCookie();

        if (!cookie.isSecure()) {
            throw new ConfiguracionInseguraException(
                    "La cookie de sesión no tiene la marca Secure. Sin ella el navegador la "
                    + "enviaría también por HTTP y bastaría una petición en claro para "
                    + "capturar la sesión.");
        }

        String sameSite = cookie.getSameSite() == null
                ? "" : cookie.getSameSite().trim().toLowerCase(Locale.ROOT);

        if (!SAME_SITE_VALIDOS.contains(sameSite)) {
            throw new ConfiguracionInseguraException(
                    "SameSite de la cookie de sesión no es válido ('" + cookie.getSameSite()
                    + "'). Use Lax (recomendado), Strict o None. Un valor desconocido hace "
                    + "que el navegador aplique su propio criterio.");
        }

        if ("none".equals(sameSite) && !cookie.isSecure()) {
            throw new ConfiguracionInseguraException(
                    "SameSite=None exige la marca Secure; sin ella el navegador descarta la "
                    + "cookie y nadie podría iniciar sesión.");
        }
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
