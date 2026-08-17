package com.maxli.auth.service;

import com.maxli.config.LoginProtectionProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Freno de fuerza bruta sobre el login (ISSUE-010).
 *
 * <p>Cuenta los fallos por combinación de <b>usuario normalizado + IP</b>: por
 * usuario solo, un atacante bloquearía al cajero legítimo desde fuera; por IP
 * sola, un NAT compartido bloquearía a toda la tienda. La clave compuesta
 * frena el ataque real sin convertirse en negación de servicio.
 *
 * <p>El servicio nunca revela si el usuario existe: se cuenta y se bloquea
 * igual para un usuario inexistente que para uno real, y quien llama responde
 * siempre el mismo mensaje genérico.
 *
 * <p>El {@link Clock} es inyectado para que las pruebas avancen el tiempo sin
 * dormir el hilo.
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    private final LoginProtectionProperties propiedades;
    private final Clock clock;

    private final Map<String, Registro> registros = new ConcurrentHashMap<>();

    /**
     * Tiempo que resta de bloqueo, o vacío si el intento puede seguir adelante.
     */
    public Optional<Duration> bloqueoRestante(String username, String ip) {
        Registro registro = registros.get(clave(username, ip));
        if (registro == null) {
            return Optional.empty();
        }

        Instant ahora = Instant.now(clock);
        if (registro.bloqueadoHasta == null || !registro.bloqueadoHasta.isAfter(ahora)) {
            return Optional.empty();
        }
        return Optional.of(Duration.between(ahora, registro.bloqueadoHasta));
    }

    /**
     * Registra un intento fallido. Al alcanzar el umbral dentro de la ventana,
     * abre un bloqueo temporal.
     */
    public void registrarFallo(String username, String ip) {
        Instant ahora = Instant.now(clock);
        purgarSiHaceFalta(ahora);

        registros.compute(clave(username, ip), (ignorado, actual) -> {
            Registro registro = (actual == null || actual.expirado(ahora, propiedades))
                    ? new Registro()
                    : actual;

            registro.fallos++;
            registro.ultimoFallo = ahora;

            if (registro.fallos >= propiedades.getMaxIntentos()) {
                registro.bloqueadoHasta = ahora.plus(propiedades.getBloqueo());
                registro.fallos = 0;   // el bloqueo sustituye al contador de la ventana
            }
            return registro;
        });
    }

    /** Un login correcto limpia los fallos acumulados de esa combinación. */
    public void registrarExito(String username, String ip) {
        registros.remove(clave(username, ip));
    }

    /**
     * Normaliza el usuario para que {@code Admin}, {@code admin } y {@code ADMIN}
     * compartan contador y no multipliquen los intentos disponibles.
     */
    private String clave(String username, String ip) {
        String usuario = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        String origen = ip == null ? "desconocida" : ip;
        return usuario + "|" + origen;
    }

    /**
     * Retira las entradas ya irrelevantes. Se dispara solo cuando el mapa roza
     * el tope configurado, de modo que el coste no recae en cada intento.
     */
    private void purgarSiHaceFalta(Instant ahora) {
        if (registros.size() < propiedades.getMaxClaves()) {
            return;
        }
        registros.entrySet().removeIf(entrada -> entrada.getValue().expirado(ahora, propiedades));

        // Si tras purgar sigue lleno, todas las entradas están vivas: se descarta
        // el registro completo antes que crecer sin límite. El coste es reiniciar
        // contadores bajo un ataque distribuido, no agotar la memoria del proceso.
        if (registros.size() >= propiedades.getMaxClaves()) {
            registros.clear();
        }
    }

    private static class Registro {
        private int fallos;
        private Instant ultimoFallo;
        private Instant bloqueadoHasta;

        /** Ni bloqueada ni con fallos dentro de la ventana: ya no aporta nada. */
        boolean expirado(Instant ahora, LoginProtectionProperties propiedades) {
            boolean bloqueoVigente = bloqueadoHasta != null && bloqueadoHasta.isAfter(ahora);
            boolean falloVigente = ultimoFallo != null
                    && ultimoFallo.plus(propiedades.getVentana()).isAfter(ahora);
            return !bloqueoVigente && !falloVigente;
        }
    }
}
