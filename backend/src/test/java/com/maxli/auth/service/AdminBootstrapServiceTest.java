package com.maxli.auth.service;

import com.maxli.config.ConfiguracionInseguraException;
import com.maxli.config.SecurityProperties;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ISSUE-010 — La credencial administrativa inicial se establece desde una
 * variable de entorno, nunca desde el repositorio.
 *
 * <p>El servicio tiene dos comportamientos deliberadamente distintos según el
 * perfil, y ambos se fijan aquí:
 *
 * <ul>
 *   <li><b>Producción:</b> una vez que la cuenta tiene contraseña propia, el
 *       bootstrap no vuelve a tocarla. Un reset en cada arranque sería, en la
 *       práctica, otra credencial conocida.</li>
 *   <li><b>Fuera de producción:</b> cada arranque realinea la credencial con
 *       {@code BOOTSTRAP_ADMIN_PASSWORD}, para que un entorno de desarrollo o
 *       de demo sea siempre reproducible sin tocar la base a mano.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminBootstrapService — credencial administrativa inicial")
class AdminBootstrapServiceTest {

    private static final String CLAVE_SEGURA = "Bootstrap#Piloto2026";

    @Mock private UsuarioRepository usuarioRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecurityProperties securityProperties = new SecurityProperties();
    private MockEnvironment environment;
    private AdminBootstrapService servicio;

    @BeforeEach
    void prepararServicio() {
        environment = new MockEnvironment();
        servicio = new AdminBootstrapService(
                usuarioRepository, passwordEncoder, securityProperties, environment);
    }

    @Test
    @DisplayName("desbloquea la cuenta admin con la contraseña provista, lista para usar")
    void estableceLaCredencialInicial() {
        Usuario admin = adminBloqueado();
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        securityProperties.getBootstrap().setAdminPassword(CLAVE_SEGURA);

        servicio.ejecutar();

        assertThat(passwordEncoder.matches(CLAVE_SEGURA, admin.getPasswordHash()))
                .as("la contraseña provista debe quedar utilizable")
                .isTrue();
        assertThat(admin.isRequiereCambioPassword())
                .as("la credencial la eligió el operador vía entorno, no hay que forzar un cambio")
                .isFalse();
        assertThat(admin.getTokenVersion()).isEqualTo(6);
        verify(usuarioRepository).save(admin);
    }

    @Test
    @DisplayName("la credencial publicada Admin@2026 deja de ser utilizable")
    void laCredencialPublicadaNoSirve() {
        Usuario admin = adminBloqueado();
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        securityProperties.getBootstrap().setAdminPassword(CLAVE_SEGURA);

        servicio.ejecutar();

        assertThat(passwordEncoder.matches("Admin@2026", admin.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("en producción no vuelve a resetear en arranques posteriores")
    void enProduccionSoloActuaUnaVez() {
        Usuario admin = adminConCredencialPropia();
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        environment.setActiveProfiles("prod");
        securityProperties.getBootstrap().setAdminPassword(CLAVE_SEGURA);

        servicio.ejecutar();

        assertThat(passwordEncoder.matches("LaQueEligioElAdmin2026", admin.getPasswordHash()))
                .as("un segundo arranque no puede pisar la contraseña ya elegida")
                .isTrue();
        assertThat(admin.getTokenVersion())
                .as("tampoco debe invalidar las sesiones en curso")
                .isEqualTo(9);
        verify(usuarioRepository, never()).save(admin);
    }

    @Test
    @DisplayName("fuera de producción cada arranque realinea la credencial con el entorno")
    void enDesarrolloRealineaLaCredencial() {
        Usuario admin = adminConCredencialPropia();
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        securityProperties.getBootstrap().setAdminPassword(CLAVE_SEGURA);

        servicio.ejecutar();

        // Deliberado: un entorno de desarrollo o de demo debe poder levantarse
        // siempre con la credencial del entorno, sin arreglar la base a mano.
        // El precio es que, mientras BOOTSTRAP_ADMIN_PASSWORD siga definida,
        // una contraseña elegida desde la UI no sobrevive al siguiente reinicio.
        assertThat(passwordEncoder.matches(CLAVE_SEGURA, admin.getPasswordHash()))
                .as("fuera de producción manda BOOTSTRAP_ADMIN_PASSWORD")
                .isTrue();
        assertThat(admin.getTokenVersion())
                .as("realinear la credencial invalida las sesiones emitidas antes")
                .isEqualTo(10);
        verify(usuarioRepository).save(admin);
    }

    @Test
    @DisplayName("en producción sin BOOTSTRAP_ADMIN_PASSWORD el arranque falla cerrado")
    void enProduccionSinCredencialFallaCerrado() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(adminBloqueado()));
        environment.setActiveProfiles("prod");

        assertThatThrownBy(() -> servicio.ejecutar())
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("BOOTSTRAP_ADMIN_PASSWORD")
                .hasMessageContaining("bloqueada");
    }

    @Test
    @DisplayName("en producción una contraseña corta también aborta el arranque")
    void enProduccionCredencialDebilFallaCerrado() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(adminBloqueado()));
        environment.setActiveProfiles("prod");
        securityProperties.getBootstrap().setAdminPassword("corta123");

        assertThatThrownBy(() -> servicio.ejecutar())
                .isInstanceOf(ConfiguracionInseguraException.class)
                .hasMessageContaining("caracteres");
    }

    @Test
    @DisplayName("en producción no se admite repetir la credencial publicada")
    void enProduccionRechazaLaCredencialPublicada() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(adminBloqueado()));
        environment.setActiveProfiles("prod");
        securityProperties.getBootstrap().setAdminPassword("Admin@2026");

        assertThatThrownBy(() -> servicio.ejecutar())
                .isInstanceOf(ConfiguracionInseguraException.class);
    }

    @Test
    @DisplayName("fuera de producción deja la cuenta bloqueada pero no impide arrancar")
    void enDesarrolloAvisaSinAbortar() {
        Usuario admin = adminBloqueado();
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        assertThatCode(() -> servicio.ejecutar()).doesNotThrowAnyException();

        assertThat(admin.getPasswordHash())
                .isEqualTo(AdminBootstrapService.CENTINELA_BLOQUEADO);
        verify(usuarioRepository, never()).save(admin);
    }

    @Test
    @DisplayName("una base sin cuenta admin no rompe el arranque")
    void sinCuentaAdminNoHaceNada() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.empty());
        environment.setActiveProfiles("prod");

        assertThatCode(() -> servicio.ejecutar()).doesNotThrowAnyException();
    }

    /** Cuenta que ya pasó por el bootstrap y tiene una contraseña elegida. */
    private Usuario adminConCredencialPropia() {
        Usuario admin = new Usuario();
        admin.setUsername("admin");
        admin.setPasswordHash(passwordEncoder.encode("LaQueEligioElAdmin2026"));
        admin.setRequiereCambioPassword(false);
        admin.setTokenVersion(9);
        return admin;
    }

    private Usuario adminBloqueado() {
        Usuario admin = new Usuario();
        admin.setIdUsuario(1L);
        admin.setUsername("admin");
        admin.setEmail("admin@maxli.com");
        admin.setEstado("ACTIVO");
        admin.setPasswordHash(AdminBootstrapService.CENTINELA_BLOQUEADO);
        admin.setRequiereCambioPassword(true);
        admin.setTokenVersion(5);
        return admin;
    }
}
