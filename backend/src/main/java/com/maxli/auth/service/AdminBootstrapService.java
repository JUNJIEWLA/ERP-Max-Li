package com.maxli.auth.service;

import com.maxli.config.ConfiguracionInseguraException;
import com.maxli.config.SecurityProperties;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

/**
 * Establece, una sola vez, la credencial administrativa inicial (ISSUE-010).
 *
 * <p>La migración V35 deja la cuenta {@code admin} con un centinela que BCrypt
 * no puede validar. Este servicio es el único camino para devolverle una
 * contraseña, y solo actúa mientras ese centinela siga ahí: en cuanto se fija
 * una contraseña —o el administrador la cambia— los arranques posteriores no
 * vuelven a tocarla. Un bootstrap que resetease en cada reinicio sería, en la
 * práctica, otra credencial conocida.
 *
 * <p>En producción, si la cuenta está bloqueada y no hay una contraseña segura
 * en {@code BOOTSTRAP_ADMIN_PASSWORD}, el arranque se aborta con un mensaje
 * operativo: es preferible no levantar el servicio a levantarlo sin forma de
 * administrarlo o, peor, con una credencial débil.
 *
 * <p>El valor de la contraseña nunca se escribe en el log.
 */
@Service
@RequiredArgsConstructor
public class AdminBootstrapService {

    /** Centinela escrito por V35; ningún hash BCrypt real puede coincidir. */
    public static final String CENTINELA_BLOQUEADO = "LOCKED::BOOTSTRAP_ADMIN_PASSWORD";

    /** La cuenta con control total merece más margen que el mínimo general de 8. */
    static final int LONGITUD_MINIMA = 12;

    /** Credencial publicada en V8: no puede volver a entrar por la puerta de atrás. */
    private static final String CREDENCIAL_PUBLICADA = "admin@2026";

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapService.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityProperties securityProperties;
    private final Environment environment;

    @Transactional
    public void ejecutar() {
        SecurityProperties.Bootstrap config = securityProperties.getBootstrap();
        String username = config.getAdminUsername();

        Optional<Usuario> encontrado = usuarioRepository.findByUsername(username);
        if (encontrado.isEmpty()) {
            return;   // Base sin cuenta administrativa: nada que desbloquear.
        }

        Usuario admin = encontrado.get();
        boolean centinelaPresente = CENTINELA_BLOQUEADO.equals(admin.getPasswordHash());

        if (!centinelaPresente && esProduccion()) {
            // En producción: ya tiene una contraseña propia. No se toca.
            return;
        }

        Optional<String> problema = validar(config.getAdminPassword());
        if (problema.isPresent()) {
            if (centinelaPresente) {
                if (esProduccion()) {
                    throw new ConfiguracionInseguraException(
                            "La cuenta administrativa '" + username + "' está bloqueada y no se puede "
                            + "establecer su credencial inicial: " + problema.get()
                            + " Defina BOOTSTRAP_ADMIN_PASSWORD (mínimo " + LONGITUD_MINIMA
                            + " caracteres) y vuelva a arrancar. El servicio no se levanta sin una "
                            + "credencial administrativa segura.");
                }
                log.warn("La cuenta administrativa '{}' sigue bloqueada: {} "
                         + "Defina BOOTSTRAP_ADMIN_PASSWORD para poder iniciar sesión.",
                        username, problema.get());
            }
            return;
        }

        admin.setPasswordHash(passwordEncoder.encode(config.getAdminPassword()));
        admin.setRequiereCambioPassword(false);
        admin.setTokenVersion(admin.getTokenVersion() + 1);
        usuarioRepository.save(admin);

        log.info("Credencial administrativa establecida exitosamente para '{}'.", username);
    }

    /** Devuelve el motivo por el que la contraseña no sirve, o vacío si sirve. */
    private Optional<String> validar(String password) {
        if (password == null || password.isBlank()) {
            return Optional.of("BOOTSTRAP_ADMIN_PASSWORD no está definida.");
        }
        if (password.length() < LONGITUD_MINIMA) {
            return Optional.of("BOOTSTRAP_ADMIN_PASSWORD tiene menos de "
                    + LONGITUD_MINIMA + " caracteres.");
        }
        if (CREDENCIAL_PUBLICADA.equals(password.toLowerCase(Locale.ROOT))) {
            return Optional.of("BOOTSTRAP_ADMIN_PASSWORD repite la credencial publicada "
                    + "en el repositorio.");
        }
        return Optional.empty();
    }

    private boolean esProduccion() {
        for (String perfil : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(perfil)) {
                return true;
            }
        }
        return false;
    }
}
