package com.maxli.config;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Arrays;

/**
 * Reconoce las peticiones que <b>no</b> pueden ser falsificadas desde otro sitio:
 * las que no traen la cookie de sesión y se autentican con
 * {@code Authorization: Bearer}.
 *
 * <p>CSRF existe porque el navegador adjunta las cookies solo por ser del
 * dominio. Sin cookie no hay credencial ambiental que robar, y un sitio ajeno no
 * puede fijar la cabecera {@code Authorization} en una petición cross-site sin
 * pasar por un preflight que CORS rechaza. Estas peticiones —scripts de
 * operación, pruebas de humo, integraciones— quedan por tanto exentas.
 *
 * <p>Si la petición trae cookie de sesión, no se exime aunque además incluya el
 * header: el filtro de autenticación da prioridad a la cookie, así que ese caso
 * sí es forjable.
 */
@RequiredArgsConstructor
public class PeticionSinCookieDeSesionMatcher implements RequestMatcher {

    private final String nombreCookieSesion;

    @Override
    public boolean matches(HttpServletRequest request) {
        return !traeCookieDeSesion(request) && traeBearer(request);
    }

    private boolean traeCookieDeSesion(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        return cookies != null && Arrays.stream(cookies)
                .anyMatch(cookie -> nombreCookieSesion.equals(cookie.getName()));
    }

    private boolean traeBearer(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        return authHeader != null && authHeader.startsWith("Bearer ");
    }
}
