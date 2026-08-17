package com.maxli.config;

import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Intercepta cada request, extrae el JWT de la cookie de sesión (o, para
 * clientes que no son navegador, del header {@code Authorization: Bearer}),
 * lo valida — incluyendo {@code token_version} — y setea la autenticación
 * en el SecurityContext.
 *
 * Cualquier fallo de autenticación se resuelve lanzando AuthenticationException,
 * que ExceptionTranslationFilter delega al AuthenticationEntryPoint de SecurityConfig
 * para responder 401 en el mismo formato JSON que el resto de la API.
 *
 * No registra el token, el usuario ni las autoridades: un log de acceso con
 * esos datos filtraría material de sesión reutilizable (ISSUE-010).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;
    private final UsuarioRepository usuarioRepository;
    private final AuthenticationEntryPoint authenticationEntryPoint;
    private final SessionCookieService sessionCookieService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        Optional<String> tokenPresentado = extraerToken(request);

        if (tokenPresentado.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = tokenPresentado.get();
        String username;

        try {
            username = jwtUtil.extraerUsername(token);
        } catch (Exception e) {
            // Token malformado — continuar sin autenticar
            filterChain.doFilter(request, response);
            return;
        }

        // Solo autenticar si no hay una autenticación previa en el contexto
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (!jwtUtil.esValido(token, userDetails)) {
                    authenticationEntryPoint.commence(request, response,
                            new BadCredentialsException("Token expirado o inválido"));
                    return;
                }

                // Verificar token_version contra la BD. Un token sin el claim 'tv'
                // (extraerTokenVersion devuelve -1) se rechaza igual que uno
                // desincronizado: antes lo dejaba pasar sin comprobar nada, así que
                // bastaba emitir un token sin ese claim para sobrevivir a un cambio
                // de contraseña, un reset o una suspensión.
                int tokenTv = jwtUtil.extraerTokenVersion(token);
                int dbTv = usuarioRepository.findByUsername(username)
                        .map(Usuario::getTokenVersion)
                        .orElse(-1);

                if (tokenTv < 0 || tokenTv != dbTv) {
                    authenticationEntryPoint.commence(request, response,
                            new BadCredentialsException("Sesión invalidada por cambios en la cuenta"));
                    return;
                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } catch (AuthenticationException e) {
                authenticationEntryPoint.commence(request, response, e);
                return;
            } catch (Exception e) {
                authenticationEntryPoint.commence(request, response,
                        new BadCredentialsException("Error de autenticación"));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * La cookie {@code HttpOnly} es el mecanismo del SPA. El header Bearer se
     * mantiene para clientes que no son navegador (scripts de operación,
     * pruebas de humo); no reabre el riesgo de CSRF porque un sitio ajeno no
     * puede fijar cabeceras en una petición cross-site sin preflight.
     */
    private Optional<String> extraerToken(HttpServletRequest request) {
        Optional<String> desdeCookie = sessionCookieService.leerToken(request);
        if (desdeCookie.isPresent()) {
            return desdeCookie;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            return token.isEmpty() ? Optional.empty() : Optional.of(token);
        }
        return Optional.empty();
    }
}
