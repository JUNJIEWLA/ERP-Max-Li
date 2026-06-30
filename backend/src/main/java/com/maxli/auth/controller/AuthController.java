package com.maxli.auth.controller;

import com.maxli.auth.dto.CambiarPasswordDTO;
import com.maxli.auth.dto.LoginRequestDTO;
import com.maxli.auth.dto.LoginResponseDTO;
import com.maxli.config.JwtUtil;
import com.maxli.permiso.entity.Permiso;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import com.maxli.usuario.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatus;
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

import java.util.HashSet;
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

    /**
     * POST /api/auth/login
     * Autentica al usuario y devuelve un JWT.
     */
    @PostMapping("/login")
    @Transactional(readOnly = true)
    public LoginResponseDTO login(@Valid @RequestBody LoginRequestDTO dto) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword()));
        } catch (AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales incorrectas");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(dto.getUsername());

        // Obtener datos adicionales del usuario desde la BD
        Usuario usuario = usuarioRepository.findByUsername(dto.getUsername())
                .orElseThrow();

        String token = jwtUtil.generarToken(userDetails, usuario.getTokenVersion());

        var roles = usuario.getRoles().stream()
                .map(rol -> rol.getNombre())
                .collect(Collectors.toSet());

        // Calculate effective permissions: from roles + extra permissions
        Set<String> permisos = calcularPermisosEfectivos(usuario);

        return new LoginResponseDTO(
                token,
                usuario.getUsername(),
                usuario.getEmail(),
                roles,
                permisos,
                86400000L,
                usuario.isRequiereCambioPassword()
        );
    }

    /**
     * GET /api/auth/me
     * Devuelve los permisos actuales del usuario autenticado.
     * Usado para polling en tiempo real.
     */
    @GetMapping("/me")
    @Transactional(readOnly = true)
    public MeResponseDTO me(@AuthenticationPrincipal UserDetails userDetails) {
        Usuario usuario = usuarioRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Set<String> permisos = calcularPermisosEfectivos(usuario);

        var roles = usuario.getRoles().stream()
                .map(rol -> rol.getNombre())
                .collect(Collectors.toSet());

        MeResponseDTO response = new MeResponseDTO();
        response.setPermisos(permisos);
        response.setRoles(roles);
        response.setTokenVersion(usuario.getTokenVersion());
        return response;
    }

    /**
     * POST /api/auth/cambiar-password
     * Permite al usuario autenticado cambiar su propia contraseña.
     * Usado para el cambio obligatorio en primer login.
     */
    @PostMapping("/cambiar-password")
    public void cambiarPassword(@AuthenticationPrincipal UserDetails userDetails,
                                 @Valid @RequestBody CambiarPasswordDTO dto) {
        Usuario usuario = usuarioRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        usuarioService.cambiarPasswordPropia(
                usuario.getIdUsuario(),
                dto.getPasswordActual(),
                dto.getPasswordNueva()
        );
    }

    /** Calcula permisos efectivos = permisos de todos los roles + permisos extra. */
    private Set<String> calcularPermisosEfectivos(Usuario usuario) {
        Set<String> permisos = new HashSet<>();
        // Permisos heredados de roles
        usuario.getRoles().forEach(rol ->
                rol.getPermisos().forEach(p -> permisos.add(p.getNombreClave()))
        );
        // Permisos extra asignados directamente
        usuario.getPermisosExtra().forEach(p -> permisos.add(p.getNombreClave()));
        return permisos;
    }

    /** DTO de respuesta para /api/auth/me */
    @Getter
    @Setter
    static class MeResponseDTO {
        private Set<String> permisos;
        private Set<String> roles;
        private int tokenVersion;
    }
}

