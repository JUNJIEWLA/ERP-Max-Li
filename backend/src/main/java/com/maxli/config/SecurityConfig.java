package com.maxli.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configuración de seguridad del ERP Max Li.
 *
 * Roles definidos:
 *   ADMIN              → Superusuario. Control total.
 *   SUPERVISOR         → Gerente de tienda. Gestión operativa + reportes de ventas.
 *   CAJERO             → Punto de venta. Facturación y caja. Sin costos ni reportes financieros.
 *   AUXILIAR_INVENTARIO → Solo lectura de catálogo + generación de etiquetas.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // habilita @PreAuthorize en controllers
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth

                // ── Rutas públicas ────────────────────────────────────────────
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/error").permitAll()

                // ── Gestión de usuarios y roles: solo ADMIN ───────────────────
                .requestMatchers("/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers("/api/roles/**").hasRole("ADMIN")

                // ── Catálogo (productos, categorías, marcas): lectura libre ───
                //    CAJERO y AUXILIAR_INVENTARIO necesitan ver el catálogo
                .requestMatchers(HttpMethod.GET, "/api/productos/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/categorias/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/marcas/**").authenticated()

                // ── Escritura en catálogo: ADMIN o SUPERVISOR ─────────────────
                .requestMatchers(HttpMethod.POST,   "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.POST,   "/api/categorias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/categorias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/categorias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.POST,   "/api/marcas/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/marcas/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/marcas/**").hasAnyRole("ADMIN", "SUPERVISOR")

                // ── Almacenes: ADMIN gestiona, todos los demás leen ───────────
                .requestMatchers(HttpMethod.GET,    "/api/almacenes/**").authenticated()
                .requestMatchers(HttpMethod.POST,   "/api/almacenes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/almacenes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/almacenes/**").hasRole("ADMIN")

                // ── Existencias / Inventario ───────────────────────────────────
                //    Lectura: todos los autenticados (AUXILIAR_INVENTARIO necesita contar)
                //    Escritura: ADMIN y SUPERVISOR
                .requestMatchers(HttpMethod.GET, "/api/existencias/**").authenticated()
                .requestMatchers(HttpMethod.POST,   "/api/existencias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/existencias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/existencias/**").hasRole("ADMIN")

                // ── Ventas / POS ───────────────────────────────────────────────
                //    CAJERO crea facturas; SUPERVISOR y ADMIN también
                .requestMatchers(HttpMethod.POST, "/api/ventas/**").hasAnyRole("ADMIN", "SUPERVISOR", "CAJERO")
                .requestMatchers(HttpMethod.GET,  "/api/ventas/**").hasAnyRole("ADMIN", "SUPERVISOR", "CAJERO")

                // ── Devoluciones: CAJERO solo lee; SUPERVISOR+ puede crear ─────
                .requestMatchers(HttpMethod.GET,  "/api/devoluciones/**").hasAnyRole("ADMIN", "SUPERVISOR", "CAJERO")
                .requestMatchers(HttpMethod.POST, "/api/devoluciones/**").hasAnyRole("ADMIN", "SUPERVISOR")

                // ── Cajas / Turnos: CAJERO accede; SUPERVISOR y ADMIN gestionan
                .requestMatchers(HttpMethod.GET,    "/api/cajas/**").authenticated()
                .requestMatchers(HttpMethod.POST,   "/api/cajas/**").hasAnyRole("ADMIN", "SUPERVISOR", "CAJERO")
                .requestMatchers(HttpMethod.PUT,    "/api/cajas/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/cajas/**").hasRole("ADMIN")

                // ── Cualquier otro endpoint: requiere autenticación ───────────
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173", "http://127.0.0.1:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
