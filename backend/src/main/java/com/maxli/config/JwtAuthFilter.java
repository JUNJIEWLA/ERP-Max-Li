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

/**
 * Intercepta cada request, extrae el token JWT del header Authorization,
 * lo valida (incluyendo token_version) y setea la autenticación en el SecurityContext.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;
    private final UsuarioRepository usuarioRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        // Si no hay header o no es Bearer, pasar al siguiente filtro
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
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

                if (jwtUtil.esValido(token, userDetails)) {
                    // Verificar token_version contra la BD
                    int tokenTv = jwtUtil.extraerTokenVersion(token);
                    int dbTv = usuarioRepository.findByUsername(username)
                            .map(Usuario::getTokenVersion)
                            .orElse(-1);
                            
                    System.out.println("DEBUG Auth: username=" + username + ", tokenTv=" + tokenTv + ", dbTv=" + dbTv);

                    if (tokenTv >= 0 && tokenTv != dbTv) {
                        System.out.println("DEBUG Auth: Token invalidado (TV mismatch)");
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sesión invalidada por cambios en la cuenta");
                        return;
                    }

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    System.out.println("DEBUG Auth: Autenticado exitosamente con roles: " + userDetails.getAuthorities());
                } else {
                    System.out.println("DEBUG Auth: jwtUtil.esValido devolvió false para " + username);
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token expirado o inválido");
                    return;
                }
            } catch (Exception e) {
                System.out.println("DEBUG Auth: Excepción durante autenticación: " + e.getMessage());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Error de autenticación");
                return;
            }
        } else if (username != null) {
            System.out.println("DEBUG Auth: Falló condición inicial. username=" + username + ", auth=" + SecurityContextHolder.getContext().getAuthentication());
        }

        filterChain.doFilter(request, response);
    }
}
