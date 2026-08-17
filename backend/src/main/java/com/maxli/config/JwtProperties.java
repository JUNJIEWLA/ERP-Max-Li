package com.maxli.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.convert.DurationUnit;

import java.time.Duration;
import java.time.temporal.ChronoUnit;

/**
 * Configuración tipada de la firma y la vigencia del JWT.
 *
 * <p>Es la <b>única</b> fuente de la expiración: {@link JwtUtil} la usa para
 * construir el token, el controlador de autenticación para informar
 * {@code expiresIn} y la cookie de sesión para su {@code Max-Age}. Antes había
 * un 86400000 escrito a mano en la respuesta de login que podía contradecir la
 * expiración real del token (ISSUE-010).
 *
 * <p>{@code @DurationUnit(MILLIS)} conserva la compatibilidad con los valores
 * numéricos ya desplegados ({@code jwt.expiration: 28800000}) y admite además la
 * notación legible ({@code 8h}).
 */
@ConfigurationProperties(prefix = "jwt")
@Getter
@Setter
public class JwtProperties {

    /** Secreto HMAC de firma. En producción lo valida {@link JwtSecretPolicy}. */
    private String secret;

    /**
     * Vigencia del token. 8 horas cubre un turno de caja completo sin obligar a
     * reautenticar a media jornada, y es mucho menos margen que las 24 h previas
     * para un token robado.
     */
    @DurationUnit(ChronoUnit.MILLIS)
    private Duration expiration = Duration.ofHours(8);

    public long getExpirationMs() {
        return expiration.toMillis();
    }
}
