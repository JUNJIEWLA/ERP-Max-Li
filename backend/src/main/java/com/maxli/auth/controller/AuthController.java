package com.maxli.auth.controller;

import com.maxli.auth.LoginBloqueadoException;
import com.maxli.auth.dto.CambiarPasswordDTO;
import com.maxli.auth.dto.LoginRequestDTO;
import com.maxli.auth.dto.LoginResponseDTO;
import com.maxli.auth.dto.MeResponseDTO;
import com.maxli.auth.service.LoginAttemptService;
import com.maxli.config.JwtUtil;
import com.maxli.config.SessionCookieService;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;
    private final UsuarioService usuarioService;
    private final SessionCookieService sessionCookieService;
    private final LoginAttemptService loginAttemptService;

    /**
     * POST /api/auth/login
     *
     * <p>Autentica al usuario y deja la sesión en una cookie {@code HttpOnly}:
     * el JWT ya no viaja en el cuerpo ni se guarda en {@code localStorage}, así
     * que un XSS no puede leerlo (ISSUE-010).
     *
     * <p>Cada fallo se contabiliza por usuario+IP; superado el umbral responde
     * 429 con {@code Retry-After}. El mensaje de error es siempre el mismo, tanto
     * si el usuario no existe como si la contraseña es incorrecta, para no
     * permitir enumeración de cuentas.
     */
    @PostMapping("/login")
    @Transactional(readOnly = true)
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO dto,
                                                  HttpServletRequest request) {
        String ip = request.getRemoteAddr();

        Optional<Duration> bloqueo = loginAttemptService.bloqueoRestante(dto.getUsername(), ip);
        if (bloqueo.isPresent()) {
            throw new LoginBloqueadoException(bloqueo.get());
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword()));
        } catch (AuthenticationException e) {
            loginAttemptService.registrarFallo(dto.getUsername(), ip);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales incorrectas");
        }

        loginAttemptService.registrarExito(dto.getUsername(), ip);

        UserDetails userDetails = userDetailsService.loadUserByUsername(dto.getUsername());

        Usuario usuario = usuarioRepository.findByUsername(dto.getUsername())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Credenciales incorrectas"));

        String token = jwtUtil.generarToken(userDetails, usuario.getTokenVersion());
        ResponseCookie cookie = sessionCookieService.construir(token);

        var roles = usuario.getRoles().stream()
                .map(rol -> rol.getNombre())
                .collect(Collectors.toSet());

        LoginResponseDTO cuerpo = new LoginResponseDTO(
                usuario.getUsername(),
                usuario.getEmail(),
                roles,
                calcularPermisosEfectivos(usuario),
                jwtUtil.getExpirationMs(),
                usuario.isRequiereCambioPassword()
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(cuerpo);
    }

    /**
     * POST /api/auth/logout
     *
     * <p>Borra la cookie de sesión. Es la única forma de cerrar sesión ahora que
     * el token no está al alcance del JavaScript de la página.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookieService.construirBorrado().toString())
                .build();
    }

    /**
     * GET /api/auth/me
     *
     * <p>Identidad y permisos vigentes del usuario autenticado. El SPA la usa
     * para recuperar la sesión al recargar —ya no puede leer nada de la cookie—
     * y para refrescar permisos revocados sin esperar al vencimiento del token.
     */
    @GetMapping("/me")
    @Transactional(readOnly = true)
    public MeResponseDTO me(@AuthenticationPrincipal UserDetails userDetails) {
        Usuario usuario = usuarioRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        var roles = usuario.getRoles().stream()
                .map(rol -> rol.getNombre())
                .collect(Collectors.toSet());

        MeResponseDTO response = new MeResponseDTO();
        response.setUsername(usuario.getUsername());
        response.setEmail(usuario.getEmail());
        response.setPermisos(calcularPermisosEfectivos(usuario));
        response.setRoles(roles);
        response.setTokenVersion(usuario.getTokenVersion());
        response.setRequiereCambioPassword(usuario.isRequiereCambioPassword());
        return response;
    }

    /**
     * POST /api/auth/cambiar-password
     *
     * <p>Cambio de contraseña propia (obligatorio en el primer inicio). El
     * servicio incrementa {@code tokenVersion}, así que la sesión en curso queda
     * invalidada; se borra también la cookie para que el cliente no reintente
     * con un token muerto.
     */
    @PostMapping("/cambiar-password")
    public ResponseEntity<Void> cambiarPassword(@AuthenticationPrincipal UserDetails userDetails,
                                                 @Valid @RequestBody CambiarPasswordDTO dto) {
        Usuario usuario = usuarioRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        usuarioService.cambiarPasswordPropia(
                usuario.getIdUsuario(),
                dto.getPasswordActual(),
                dto.getPasswordNueva()
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookieService.construirBorrado().toString())
                .build();
    }

    /** Calcula permisos efectivos = permisos de todos los roles + permisos extra. */
    private Set<String> calcularPermisosEfectivos(Usuario usuario) {
        Set<String> permisos = new HashSet<>();
        usuario.getRoles().forEach(rol ->
                rol.getPermisos().forEach(p -> permisos.add(p.getNombreClave()))
        );
        usuario.getPermisosExtra().forEach(p -> permisos.add(p.getNombreClave()));
        return permisos;
    }
}
