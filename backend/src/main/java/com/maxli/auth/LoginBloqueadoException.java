package com.maxli.auth;

import lombok.Getter;

import java.time.Duration;

/**
 * Se lanza cuando una combinación usuario+IP superó el umbral de intentos
 * fallidos de login y sigue dentro de la ventana de bloqueo.
 *
 * <p>Se traduce a HTTP 429 con {@code Retry-After}. El mensaje es deliberadamente
 * genérico: no dice si el usuario existe.
 */
@Getter
public class LoginBloqueadoException extends RuntimeException {

    private final transient Duration esperaRestante;

    public LoginBloqueadoException(Duration esperaRestante) {
        super("Demasiados intentos de inicio de sesión. Espere e inténtelo de nuevo.");
        this.esperaRestante = esperaRestante;
    }

    /** Segundos a publicar en {@code Retry-After}; siempre al menos 1. */
    public long segundosRestantes() {
        return Math.max(1, esperaRestante.toSeconds());
    }
}
