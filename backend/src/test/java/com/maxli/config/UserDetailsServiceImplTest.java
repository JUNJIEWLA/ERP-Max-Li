package com.maxli.config;

import com.maxli.permiso.entity.Permiso;
import com.maxli.rol.entity.Rol;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock private UsuarioRepository usuarioRepository;
    @InjectMocks private UserDetailsServiceImpl userDetailsService;

    @Test
    void carga_roles_y_permisos_de_rol_como_authorities() {
        Permiso ventaCrear = permiso("VENTA_CREAR");
        Permiso cajaOperar = permiso("CAJA_OPERAR");
        Rol cajero = rol("CAJERO", ventaCrear, cajaOperar);

        Usuario usuario = usuario("cajero1", "ACTIVO", false, cajero);

        when(usuarioRepository.findByUsername("cajero1")).thenReturn(Optional.of(usuario));

        UserDetails details = userDetailsService.loadUserByUsername("cajero1");
        Set<String> authorities = authorityStrings(details);

        assertThat(authorities).contains("ROLE_CAJERO", "VENTA_CREAR", "CAJA_OPERAR");
    }

    @Test
    void incluye_permisos_extra_asignados_directamente_al_usuario() {
        Rol cajero = rol("CAJERO", permiso("VENTA_CREAR"));
        Usuario usuario = usuario("cajero2", "ACTIVO", false, cajero);
        usuario.setPermisosExtra(Set.of(permiso("PROVEEDOR_GESTIONAR")));

        when(usuarioRepository.findByUsername("cajero2")).thenReturn(Optional.of(usuario));

        Set<String> authorities = authorityStrings(userDetailsService.loadUserByUsername("cajero2"));

        assertThat(authorities).contains("VENTA_CREAR", "PROVEEDOR_GESTIONAR");
    }

    @Test
    void usuario_pendiente_de_cambio_de_password_solo_recibe_authority_de_cambio_obligatorio() {
        Rol admin = rol("ADMIN", permiso("USUARIO_GESTIONAR"), permiso("PROVEEDOR_GESTIONAR"));
        Usuario usuario = usuario("nuevo", "ACTIVO", true, admin);

        when(usuarioRepository.findByUsername("nuevo")).thenReturn(Optional.of(usuario));

        Set<String> authorities = authorityStrings(userDetailsService.loadUserByUsername("nuevo"));

        assertThat(authorities).containsExactly("PWD_CHANGE_REQUIRED");
    }

    @Test
    void usuario_sin_roles_pero_con_permiso_personalizado_solo_recibe_ese_permiso() {
        Usuario usuario = usuario("independiente", "ACTIVO", false);
        usuario.setPermisosExtra(Set.of(permiso("PROVEEDOR_GESTIONAR")));

        when(usuarioRepository.findByUsername("independiente")).thenReturn(Optional.of(usuario));

        Set<String> authorities = authorityStrings(userDetailsService.loadUserByUsername("independiente"));

        assertThat(authorities).containsExactly("PROVEEDOR_GESTIONAR");
    }

    @Test
    void rechaza_usuario_inactivo() {
        Usuario usuario = usuario("inactivo", "INACTIVO", false);
        when(usuarioRepository.findByUsername("inactivo")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("inactivo"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    private Set<String> authorityStrings(UserDetails details) {
        return details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    private Usuario usuario(String username, String estado, boolean requiereCambioPassword, Rol... roles) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPasswordHash("hash");
        usuario.setEstado(estado);
        usuario.setRequiereCambioPassword(requiereCambioPassword);
        usuario.setRoles(new HashSet<>(Set.of(roles)));
        return usuario;
    }

    private Rol rol(String nombre, Permiso... permisos) {
        Rol rol = new Rol();
        rol.setNombre(nombre);
        rol.setPermisos(new HashSet<>(Set.of(permisos)));
        return rol;
    }

    private Permiso permiso(String nombreClave) {
        Permiso permiso = new Permiso();
        permiso.setNombreClave(nombreClave);
        return permiso;
    }
}
