package com.maxli.config;

/**
 * Se lanza durante el arranque cuando el despliegue no cumple la línea base de
 * seguridad exigida en producción (ISSUE-010). Extiende {@link IllegalStateException}
 * para que Spring aborte la creación del contexto: el objetivo es fallar cerrado,
 * nunca arrancar degradado.
 *
 * <p>El mensaje debe ser operativo — decir qué variable falta y cómo generarla —
 * y jamás incluir el valor observado.
 */
public class ConfiguracionInseguraException extends IllegalStateException {

    public ConfiguracionInseguraException(String message) {
        super(message);
    }
}
