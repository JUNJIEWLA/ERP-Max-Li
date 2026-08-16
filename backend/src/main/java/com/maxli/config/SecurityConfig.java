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
    private final JsonAuthResponseHandler jsonAuthResponseHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jsonAuthResponseHandler)
                .accessDeniedHandler(jsonAuthResponseHandler)
            )
            .authorizeHttpRequests(auth -> auth

                // ── Rutas públicas ────────────────────────────────────────────
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/error").permitAll()

                // ── Sesión propia: alcanzable incluso con cambio de contraseña
                //    pendiente (PWD_CHANGE_REQUIRED es la única autoridad en ese caso) ─
                .requestMatchers("/api/auth/cambiar-password").authenticated()
                .requestMatchers("/api/auth/me").authenticated()

                // ── Gestión de usuarios y roles ────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/roles/permisos")
                        .hasAnyAuthority("USUARIO_GESTIONAR", "ROL_GESTIONAR")
                .requestMatchers("/api/usuarios/**").hasAuthority("USUARIO_GESTIONAR")
                .requestMatchers("/api/roles/**").hasAuthority("ROL_GESTIONAR")

                // ── Historial de costos: información de costos, no de catálogo ─
                .requestMatchers(HttpMethod.GET, "/api/productos/*/historial-costos")
                        .hasAuthority("PRODUCTO_GESTIONAR")

                // ── Catálogo: lectura con PRODUCTO_VER, escritura con PRODUCTO_GESTIONAR
                .requestMatchers(HttpMethod.GET,
                        "/api/productos/**", "/api/categorias/**", "/api/marcas/**",
                        "/api/ofertas/**", "/api/empaques/**")
                        .hasAuthority("PRODUCTO_VER")
                .requestMatchers(HttpMethod.POST,
                        "/api/productos/**", "/api/categorias/**", "/api/marcas/**",
                        "/api/ofertas/**", "/api/empaques/**")
                        .hasAuthority("PRODUCTO_GESTIONAR")
                .requestMatchers(HttpMethod.PUT,
                        "/api/productos/**", "/api/categorias/**", "/api/marcas/**",
                        "/api/ofertas/**", "/api/empaques/**")
                        .hasAuthority("PRODUCTO_GESTIONAR")
                .requestMatchers(HttpMethod.DELETE,
                        "/api/productos/**", "/api/categorias/**", "/api/marcas/**",
                        "/api/ofertas/**", "/api/empaques/**")
                        .hasAuthority("PRODUCTO_GESTIONAR")
                .requestMatchers("/api/alertas-costo/**").hasAuthority("PRODUCTO_GESTIONAR")

                // ── Almacenes ───────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/almacenes/**").hasAuthority("INVENTARIO_VER")
                .requestMatchers(HttpMethod.POST,   "/api/almacenes/**").hasAuthority("ALMACEN_GESTIONAR")
                .requestMatchers(HttpMethod.PUT,    "/api/almacenes/**").hasAuthority("ALMACEN_GESTIONAR")
                .requestMatchers(HttpMethod.DELETE, "/api/almacenes/**").hasAuthority("ALMACEN_GESTIONAR")

                // ── Existencias / Movimientos / Conteos ─────────────────────
                .requestMatchers(HttpMethod.GET,
                        "/api/existencias/**", "/api/movimientos/**", "/api/conteos/**")
                        .hasAuthority("INVENTARIO_VER")
                .requestMatchers(HttpMethod.POST,
                        "/api/existencias/**", "/api/movimientos/**", "/api/conteos/**")
                        .hasAuthority("INVENTARIO_GESTIONAR")
                .requestMatchers(HttpMethod.PUT,
                        "/api/existencias/**", "/api/movimientos/**", "/api/conteos/**")
                        .hasAuthority("INVENTARIO_GESTIONAR")
                .requestMatchers(HttpMethod.DELETE,
                        "/api/existencias/**", "/api/movimientos/**", "/api/conteos/**")
                        .hasAuthority("INVENTARIO_GESTIONAR")

                // ── Ventas / POS ─────────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/ventas/**").hasAuthority("VENTA_CREAR")
                .requestMatchers(HttpMethod.GET,  "/api/ventas/**").hasAuthority("VENTA_VER")

                // ── Cupones: aplicar es parte del flujo de venta; el resto es gestión ─
                .requestMatchers(HttpMethod.POST, "/api/cupones/aplicar").hasAuthority("VENTA_CREAR")
                .requestMatchers("/api/cupones/**").hasAuthority("CUPON_GESTIONAR")

                // ── Devoluciones: lectura con VENTA_VER, creación con DEVOLUCION_CREAR ─
                .requestMatchers(HttpMethod.GET,  "/api/devoluciones/**").hasAuthority("VENTA_VER")
                .requestMatchers(HttpMethod.POST, "/api/devoluciones/**").hasAuthority("DEVOLUCION_CREAR")

                // ── Cajas / Turnos / Caja chica ──────────────────────────────
                .requestMatchers("/api/cajas/turnos/**").hasAuthority("CAJA_OPERAR")
                .requestMatchers("/api/cajas/chicas/**").hasAuthority("CAJA_GESTIONAR")
                .requestMatchers(HttpMethod.GET, "/api/cajas/**")
                        .hasAnyAuthority("CAJA_OPERAR", "CAJA_GESTIONAR")
                .requestMatchers(HttpMethod.POST,   "/api/cajas/**").hasAuthority("CAJA_GESTIONAR")
                .requestMatchers(HttpMethod.PUT,    "/api/cajas/**").hasAuthority("CAJA_GESTIONAR")
                .requestMatchers(HttpMethod.DELETE, "/api/cajas/**").hasAuthority("CAJA_GESTIONAR")

                // ── Clientes ─────────────────────────────────────────────────
                .requestMatchers("/api/clientes/**").hasAuthority("CLIENTE_GESTIONAR")

                // ── Compras: proveedores, órdenes, recepción, gastos ─────────
                .requestMatchers("/api/proveedores/**").hasAuthority("PROVEEDOR_GESTIONAR")
                .requestMatchers(
                        "/api/ordenes-compra/**", "/api/notas-recepcion/**",
                        "/api/gastos/**", "/api/alertas-retraso-oc/**")
                        .hasAuthority("COMPRA_GESTIONAR")

                // ── NCF: preview es parte del flujo de venta; el resto es fiscal ─
                .requestMatchers(HttpMethod.GET, "/api/ncf/preview/**")
                        .hasAnyAuthority("VENTA_CREAR", "NCF_GESTIONAR")
                .requestMatchers("/api/ncf/**").hasAuthority("NCF_GESTIONAR")

                // ── Cualquier otro endpoint: denegado por defecto ─────────────
                .anyRequest().denyAll()

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
        config.setAllowedOrigins(List.of("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
