package com.maxli.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Reloj del sistema como bean inyectable.
 *
 * <p>Permite que las pruebas del freno de fuerza bruta avancen el tiempo con un
 * {@code Clock.fixed} en lugar de dormir el hilo: sin esto, comprobar que un
 * bloqueo de 15 minutos vence exigiría esperar 15 minutos.
 */
@Configuration
public class ClockConfig {

    @Bean
    @ConditionalOnMissingBean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
