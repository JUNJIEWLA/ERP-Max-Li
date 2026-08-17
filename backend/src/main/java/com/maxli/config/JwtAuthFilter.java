package com.maxli.config;

import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
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
 * Un token inválido no corta la petición: se deja seguir sin autenticar y es la
 * matriz de {@link SecurityConfig} la que decide. Los endpoints protegidos
 * responden 401 vía AuthenticationEntryPoint, en el mismo formato JSON que el
 * resto de la API, y los públicos —login y logout— siguen siendo alcanzables
 * con una cookie muerta encima. Ver {@link #versionVigente}.
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

                if (jwtUtil.esValido(token, userDetails) && versionVigente(token, username)) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (Exception e) {
                // Usuario inexistente, inactivo o cualquier fallo al resolverlo:
                // la petición sigue sin autenticar, igual que un token inválido.
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Un token que no supera la validación no corta la petición: simplemente no
     * autentica y deja seguir la cadena.
     *
     * <p>Cortar aquí con un 401 parecía más estricto, pero encerraba al usuario
     * fuera del sistema. La cookie invalidada sigue en el navegador y se adjunta
     * sola en <i>toda</i> petición al dominio, incluidas {@code /api/auth/login}
     * y {@code /api/auth/logout} — las dos únicas que permiten salir de ese
     * estado. Tras un cambio de contraseña, un reset o una suspensión, el
     * usuario no podía ni volver a entrar ni limpiar la cookie hasta que
     * expirase sola.
     *
     * <p>No se pierde nada de rigor: sin autenticación en el contexto, la matriz
     * de {@link SecurityConfig} responde 401 en cualquier endpoint protegido.
     * Solo cambia el caso de los endpoints públicos, que es justo el que hay que
     * dejar pasar.
     */
    private boolean versionVigente(String token, String username) {
        // Un token sin el claim 'tv' (extraerTokenVersion devuelve -1) se trata
        // igual que uno desincronizado: antes se dejaba pasar sin comprobar
        // nada, así que bastaba emitir un token sin ese claim para sobrevivir a
        // un cambio de contraseña, un reset o una suspensión.
        int tokenTv = jwtUtil.extraerTokenVersion(token);
        int dbTv = usuarioRepository.findByUsername(username)
                .map(Usuario::getTokenVersion)
                .orElse(-1);

        return tokenTv >= 0 && tokenTv == dbTv;
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
