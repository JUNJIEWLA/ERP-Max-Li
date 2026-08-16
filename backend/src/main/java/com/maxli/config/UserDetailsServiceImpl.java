package com.maxli.config;

import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Implementación de UserDetailsService que carga el usuario desde la BD
 * y convierte sus Roles y Permisos (de rol y por excepción) en GrantedAuthority
 * reales para Spring Security: ROLE_<rol> + <nombreClave> de cada permiso efectivo.
 *
 * Rechaza usuarios con estado INACTIVO o SUSPENDIDO.
 *
 * Un usuario con cambio de contraseña pendiente recibe únicamente la
 * autoridad PWD_CHANGE_REQUIRED (sin roles ni permisos de negocio), de modo
 * que la matriz de SecurityConfig lo deja fuera de toda operación excepto
 * /api/auth/me y /api/auth/cambiar-password.
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    public static final String AUTHORITY_PWD_CHANGE_REQUIRED = "PWD_CHANGE_REQUIRED";

    private final UsuarioRepository usuarioRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Usuario no encontrado: " + username));

        if (!"ACTIVO".equals(usuario.getEstado())) {
            throw new UsernameNotFoundException("Usuario inactivo o suspendido: " + username);
        }

        List<GrantedAuthority> authorities = usuario.isRequiereCambioPassword()
                ? List.of(new SimpleGrantedAuthority(AUTHORITY_PWD_CHANGE_REQUIRED))
                : construirAuthorities(usuario);

        return User.builder()
                .username(usuario.getUsername())
                .password(usuario.getPasswordHash())
                .authorities(authorities)
                .build();
    }

    private List<GrantedAuthority> construirAuthorities(Usuario usuario) {
        Stream<GrantedAuthority> rolesComoAuthority = usuario.getRoles().stream()
                .map(rol -> new SimpleGrantedAuthority("ROLE_" + rol.getNombre()));

        Stream<GrantedAuthority> permisosDeRoles = usuario.getRoles().stream()
                .flatMap(rol -> rol.getPermisos().stream())
                .map(permiso -> new SimpleGrantedAuthority(permiso.getNombreClave()));

        Stream<GrantedAuthority> permisosExtra = usuario.getPermisosExtra().stream()
                .map(permiso -> new SimpleGrantedAuthority(permiso.getNombreClave()));

        return Stream.of(rolesComoAuthority, permisosDeRoles, permisosExtra)
                .flatMap(s -> s)
                .distinct()
                .collect(Collectors.toList());
    }
}
