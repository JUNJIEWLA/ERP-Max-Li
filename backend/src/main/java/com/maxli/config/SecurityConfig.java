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

@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // habilita @PreAuthorize en controllers
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // ── Rutas públicas ──────────────────────────────────────
                .requestMatchers("/api/auth/**").permitAll()

                // ── Solo ADMIN puede gestionar usuarios y roles ─────────
                .requestMatchers("/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers("/api/roles/**").hasRole("ADMIN")

                // ── Lectura de productos/existencias: cualquier autenticado
                .requestMatchers(HttpMethod.GET, "/api/productos/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/categorias/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/marcas/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/existencias/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/cajas/**").authenticated()

                // ── Escritura en catálogo: solo ADMIN o SUPERVISOR ──────
                .requestMatchers(HttpMethod.POST,   "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.DELETE, "/api/productos/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.POST,   "/api/categorias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.POST,   "/api/marcas/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.POST,   "/api/existencias/**").hasAnyRole("ADMIN", "SUPERVISOR")
                .requestMatchers(HttpMethod.PUT,    "/api/existencias/**").hasAnyRole("ADMIN", "SUPERVISOR")

                // ── Cualquier otro endpoint: requiere autenticación ─────
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
}
