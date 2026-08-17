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
     * Se activa en el perfil {@code prod}; en dev queda apagado para que
     * {@code http://localhost} siga funcionando.
     */
    private boolean requireHttps = false;

    private Cookie cookie = new Cookie();

    private Bootstrap bootstrap = new Bootstrap();

    @Getter
    @Setter
    public static class Cookie {

        /** Nombre de la cookie de sesión que transporta el JWT. */
        private String name = "maxli_session";

        /**
         * Marca {@code Secure}. Se enciende junto con {@code requireHttps} en
         * producción; en dev debe quedar apagada o el navegador descartaría la
         * cookie sobre http://localhost.
         */
        private boolean secure = false;

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
