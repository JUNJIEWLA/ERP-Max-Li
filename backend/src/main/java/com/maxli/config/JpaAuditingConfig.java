package com.maxli.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Separado de MaxLiApplication para que los slices de prueba (@WebMvcTest)
 * no lo carguen: @EnableJpaAuditing en la clase principal fuerza la creación
 * de un JpaMappingContext incluso sin DataSource configurado en el slice.
 */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
