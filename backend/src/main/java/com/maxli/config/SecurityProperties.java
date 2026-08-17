package com.maxli.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Ajustes de despliegue de la capa de seguridad: transporte, cookie de sesión y
 * credencial administrativa inicial.
 */
@ConfigurationProperties(prefix = "maxli.security")
@Getter
@Setter
public class SecurityProperties {

    /**
     * Exige HTTPS: redirige toda petición en texto plano y habilita HSTS.
     * Por defecto <b>activado</b>: el perfil {@code dev} lo apaga a propósito
     * para que {@code http://localhost} siga funcionando. Lo inseguro debe
     * pedirse explícitamente, nunca obtenerse por omisión.
     */
    private boolean requireHttps = true;

    private Cookie cookie = new Cookie();

    private Bootstrap bootstrap = new Bootstrap();

    @Getter
    @Setter
    public static class Cookie {

        /** Nombre de la cookie de sesión que transporta el JWT. */
        private String name = "maxli_session";

        /**
         * Marca {@code Secure}. Encendida por defecto; el perfil {@code dev} la
         * apaga porque el navegador descartaría la cookie sobre
         * {@code http://localhost}.
         */
        private boolean secure = true;

        /**
         * {@code Lax} basta porque el SPA se sirve desde el mismo origen que la
         * API detrás del reverse proxy. Configurable por si el piloto separa
         * dominios y necesita {@code None} (que exige {@code Secure}).
         */
        private String sameSite = "Lax";
    }

    @Getter
    @Setter
    public static class Bootstrap {

        /**
         * Contraseña de la credencial administrativa inicial, tomada de
         * {@code BOOTSTRAP_ADMIN_PASSWORD}. Solo se consume una vez, cuando la
         * cuenta admin está bloqueada por la migración V35. Nunca se registra
         * en logs ni se devuelve por la API.
         */
        private String adminPassword;

        /** Usuario administrativo que recibe la credencial inicial. */
        private String adminUsername = "admin";
    }
}
