package com.maxli.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Parámetros del freno de fuerza bruta sobre {@code POST /api/auth/login}
 * (ISSUE-010: el login no tenía límite de intentos, retardo ni bloqueo).
 */
@ConfigurationProperties(prefix = "maxli.security.login")
@Getter
@Setter
public class LoginProtectionProperties {

    /** Fallos tolerados dentro de la ventana antes de bloquear. */
    private int maxIntentos = 5;

    /** Ventana en la que se acumulan los fallos. */
    private Duration ventana = Duration.ofMinutes(10);

    /**
     * Duración del bloqueo una vez alcanzado el umbral. Es temporal a propósito:
     * un bloqueo permanente convertiría el freno en una negación de servicio
     * contra el cajero legítimo.
     */
    private Duration bloqueo = Duration.ofMinutes(15);

    /**
     * Tope de claves rastreadas en memoria. Evita que una ráfaga desde miles de
     * IPs distintas haga crecer el mapa sin límite.
     */
    private int maxClaves = 10_000;
}
