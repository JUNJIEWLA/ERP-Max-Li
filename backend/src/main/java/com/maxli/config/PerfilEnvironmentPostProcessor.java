package com.maxli.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Aplica {@link PerfilPolicy} durante la preparación del entorno, antes de que
 * se cree un solo bean.
 *
 * <p>La comprobación vivía en un {@code @PostConstruct} y llegaba tarde: con el
 * perfil sin declarar, {@code JwtUtil} se instanciaba primero y reventaba con un
 * {@code WeakKeyException} sobre un secreto vacío. Fallaba cerrado, sí, pero el
 * operador recibía un error de criptografía en lugar de «declare el perfil».
 * Aquí el diagnóstico llega antes que cualquier síntoma.
 */
public class PerfilEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                        SpringApplication application) {
        PerfilPolicy.validar(environment.getActiveProfiles());
    }

    @Override
    public int getOrder() {
        // Después de que los archivos de configuración hayan poblado el entorno,
        // para leer un spring.profiles.active declarado en YAML y no solo el de
        // la línea de órdenes.
        return Ordered.LOWEST_PRECEDENCE;
    }
}
