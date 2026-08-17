package com.maxli.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtUtil(JwtProperties propiedades) {
        this.secretKey = Keys.hmacShaKeyFor(
                propiedades.getSecret().getBytes(StandardCharsets.UTF_8));
        this.expirationMs = propiedades.getExpirationMs();
    }

    /**
     * Vigencia configurada del token. Es la fuente única que consumen la
     * respuesta de login y el {@code Max-Age} de la cookie de sesión, para que
     * nunca contradigan la expiración real del JWT.
     */
    public long getExpirationMs() {
        return expirationMs;
    }

    /** Genera un token JWT con username, roles y tokenVersion como claims. */
    public String generarToken(UserDetails userDetails, int tokenVersion) {
        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        return Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("roles", roles)
                .claim("tv", tokenVersion)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(secretKey)
                .compact();
    }

    /** Extrae el username del token. */
    public String extraerUsername(String token) {
        return parsearClaims(token).getSubject();
    }

    /** Extrae el tokenVersion del JWT. Retorna -1 si no existe (tokens legacy). */
    public int extraerTokenVersion(String token) {
        try {
            Object tv = parsearClaims(token).get("tv");
            if (tv instanceof Number) {
                return ((Number) tv).intValue();
            }
            return -1;
        } catch (Exception e) {
            return -1;
        }
    }

    /** Valida que el token sea válido y corresponda al usuario dado. */
    public boolean esValido(String token, UserDetails userDetails) {
        try {
            String username = extraerUsername(token);
            return username.equals(userDetails.getUsername()) && !estaExpirado(token);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private boolean estaExpirado(String token) {
        return parsearClaims(token).getExpiration().before(new Date());
    }

    private Claims parsearClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
