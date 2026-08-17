package com.maxli.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Orígenes autorizados para llamar a la API desde un navegador.
 *
 * <p>Se alimenta de {@code CORS_ALLOWED_ORIGINS} (lista separada por comas).
 * Antes {@code SecurityConfig} fijaba localhost en el código e ignoraba la
 * propiedad, de modo que un despliegue real no podía declarar su dominio
 * y localhost quedaba permitido en producción (ISSUE-010).
 */
@ConfigurationProperties(prefix = "cors")
@Getter
@Setter
public class CorsProperties {

    private List<String> allowedOrigins = new ArrayList<>();

    /** Descarta entradas vacías producidas por listas con comas sobrantes. */
    public List<String> getAllowedOrigins() {
        return allowedOrigins.stream()
                .filter(origen -> origen != null && !origen.isBlank())
                .map(String::trim)
                .toList();
    }
}
