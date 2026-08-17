package com.maxli.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Materializa el token CSRF en cada respuesta.
 *
 * <p>Spring Security genera el token de forma diferida: si nadie lo lee, la
 * cookie {@code XSRF-TOKEN} nunca se escribe y el SPA no tendría qué enviar en
 * su primera petición mutante. Basta con invocar {@code getToken()} para que el
 * repositorio de cookies lo emita.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
