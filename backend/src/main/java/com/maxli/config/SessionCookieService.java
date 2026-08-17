package com.maxli.config;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Emite, lee y borra la cookie que transporta el JWT de sesión.
 *
 * <p>Sustituye al token en {@code localStorage} (ISSUE-010): al ser
 * {@code HttpOnly} ningún script de la página puede leerla, de modo que un XSS
 * ya no permite exfiltrar la sesión. El precio es la exposición a CSRF, que se
 * cubre con el token sincronizador configurado en {@link SecurityConfig}.
 *
 * <p>{@code Max-Age} sale de {@link JwtProperties}, la misma fuente que la
 * expiración del JWT, para que la cookie no sobreviva al token ni al revés.
 */
@Component
@RequiredArgsConstructor
public class SessionCookieService {

    private final SecurityProperties securityProperties;
    private final JwtProperties jwtProperties;

    /** Cookie de sesión con el token recién emitido. */
    public ResponseCookie construir(String token) {
        return base(token)
                .maxAge(jwtProperties.getExpiration())
                .build();
    }

    /**
     * Cookie de borrado: mismo nombre y atributos, valor vacío y
     * {@code Max-Age=0} para que el navegador la descarte de inmediato.
     */
    public ResponseCookie construirBorrado() {
        return base("")
                .maxAge(Duration.ZERO)
                .build();
    }

    /** Nombre configurado de la cookie de sesión. */
    public String nombre() {
        return securityProperties.getCookie().getName();
    }

    /** Extrae el token de sesión de la petición, si viene. */
    public Optional<String> leerToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> nombre().equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(valor -> valor != null && !valor.isBlank())
                .findFirst();
    }

    private ResponseCookie.ResponseCookieBuilder base(String valor) {
        SecurityProperties.Cookie config = securityProperties.getCookie();
        return ResponseCookie.from(config.getName(), valor)
                .httpOnly(true)
                .secure(config.isSecure())
                .sameSite(config.getSameSite())
                .path("/");
    }

    /** Cabecera lista para añadir a la respuesta. */
    public static String header() {
        return HttpHeaders.SET_COOKIE;
    }
}
