package com.maxli.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.session.SessionManagementFilter;
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
@EnableConfigurationProperties({
        JwtProperties.class, CorsProperties.class,
        SecurityProperties.class, LoginProtectionProperties.class})
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final JsonAuthResponseHandler jsonAuthResponseHandler;
    private final CorsProperties corsProperties;
    private final SecurityProperties securityProperties;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf
                // La sesión viaja en cookie, así que el navegador la adjunta sola
                // en peticiones cross-site: hace falta un token sincronizador.
                // El repositorio deja XSRF-TOKEN legible por el SPA, que lo
                // reenvía en la cabecera X-XSRF-TOKEN; un sitio ajeno no puede
                // leer esa cookie ni fijar esa cabecera.
                .csrfTokenRepository(csrfTokenRepository())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                // El login es la petición que estrena el token; forzarlo antes
                // dejaría al usuario sin forma de autenticarse.
                .ignoringRequestMatchers("/api/auth/login")
                // Un cliente que se identifica solo con Bearer no expone
                // credenciales ambientales y por tanto no es forjable.
                .ignoringRequestMatchers(new PeticionSinCookieDeSesionMatcher(
                        securityProperties.getCookie().getName()))
            )
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .httpStrictTransportSecurity(hsts -> hsts
                        .includeSubDomains(true)
                        .maxAgeInSeconds(31_536_000))     // 1 año
                .referrerPolicy(referrer -> referrer
                        .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN))
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jsonAuthResponseHandler)
                .accessDeniedHandler(jsonAuthResponseHandler)
            )
            .authorizeHttpRequests(auth -> auth

                // ── Rutas públicas ────────────────────────────────────────────
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                // Logout es público a propósito: su trabajo es borrar la cookie,
                // y quien más lo necesita es justamente quien tiene una cookie
                // que ya no autentica. Exigir sesión válida para poder cerrarla
                // dejaba al usuario sin forma de limpiar el estado. Sigue
                // protegido por CSRF, así que un tercero no puede forzarlo.
                .requestMatchers("/api/auth/logout").permitAll()
                .requestMatchers("/error").permitAll()

                // ── Sondas de salud (ISSUE-015) ───────────────────────────────
                // El reverse proxy y el arranque del despliegue las consultan sin
                // sesión. Se listan una por una y nunca con comodín: /actuator/**
                // dejaría entrar cualquier endpoint que se habilitara después por
                // descuido. El cuerpo va recortado a {"status":"UP"} desde
                // application.yml, así que no revelan nada aunque sean públicas.
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/actuator/health/liveness").permitAll()
                .requestMatchers(HttpMethod.GET, "/actuator/health/readiness").permitAll()

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

                // ── Empresa: GET para cualquier autenticado, PUT solo administrador ─
                // Los datos de empresa (nombre, RNC) se usan en encabezados de
                // facturas y reportes, así que deben ser legibles por todos.
                .requestMatchers(HttpMethod.GET, "/api/empresa/**").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/empresa/**").hasAuthority("CONFIGURACION_VER")

                // ── Cualquier otro endpoint: denegado por defecto ─────────────
                .anyRequest().denyAll()

            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Después de SessionManagementFilter, no antes. Como la sesión es
            // stateless y JwtAuthFilter autentica en cada petición,
            // CsrfAuthenticationStrategy rota el token en todas: borra la cookie
            // XSRF-TOKEN y deja el token nuevo en diferido, que solo se emite si
            // alguien lo lee. Con este filtro antes de esa rotación, quien leía
            // era el token viejo y la respuesta salía con la cookie borrada: el
            // SPA se quedaba sin nada que enviar y la siguiente mutación moría
            // en 403 (el cobro del POS, que encadena /ventas/recalcular y
            // /ventas). Colocado después, materializa el token rotado y la misma
            // respuesta ya lo reemite.
            .addFilterAfter(new CsrfCookieFilter(), SessionManagementFilter.class);

        // En producción no se atiende nada en texto plano: detrás del reverse
        // proxy, `server.forward-headers-strategy: framework` hace que
        // X-Forwarded-Proto decida si la petición llegó cifrada.
        if (securityProperties.isRequireHttps()) {
            http.requiresChannel(channel -> channel.anyRequest().requiresSecure());
        }

        return http.build();
    }

    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repositorio = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repositorio.setCookiePath("/");
        repositorio.setCookieCustomizer(cookie -> cookie
                .secure(securityProperties.getCookie().isSecure())
                .sameSite(securityProperties.getCookie().getSameSite()));
        return repositorio;
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

    /**
     * Orígenes tomados de {@code CORS_ALLOWED_ORIGINS}. Antes estaban fijados a
     * localhost en el código, así que ningún despliegue real podía declarar su
     * dominio y el del desarrollo quedaba permitido en producción (ISSUE-010).
     *
     * <p>Se usa {@code setAllowedOrigins} —coincidencia exacta— y nunca patrones:
     * con {@code allowCredentials=true} un comodín entregaría la cookie de sesión
     * a cualquier sitio. {@link GuardaSeguridadProduccion} rechaza el arranque si
     * la lista viene vacía o con comodines.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(corsProperties.getAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-XSRF-TOKEN", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
