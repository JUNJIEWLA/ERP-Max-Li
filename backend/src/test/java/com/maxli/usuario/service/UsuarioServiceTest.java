package com.maxli.usuario.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.repository.RolRepository;
import com.maxli.usuario.dto.UsuarioRequestDTO;
import com.maxli.usuario.dto.UsuarioResponseDTO;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.mapper.UsuarioMapper;
import com.maxli.usuario.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private RolRepository rolRepository;
    @Mock private UsuarioMapper usuarioMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @InjectMocks private UsuarioService usuarioService;

    @Test
    void crear_hashea_contrasena_y_guarda_usuario() {
        UsuarioRequestDTO request = request();
        Usuario entity = new Usuario();
        Usuario saved = new Usuario();
        saved.setIdUsuario(1L);
        saved.setRoles(new HashSet<>());

        UsuarioResponseDTO expectedDto = new UsuarioResponseDTO();
        expectedDto.setIdUsuario(1L);
        expectedDto.setUsername("juan");

        when(usuarioRepository.existsByUsername("juan")).thenReturn(false);
        when(usuarioRepository.existsByEmail("juan@mail.com")).thenReturn(false);
        when(passwordEncoder.encode("secreto123")).thenReturn("$2a$hashed");
        when(usuarioMapper.toEntity(request, "$2a$hashed")).thenReturn(entity);
        when(usuarioRepository.save(entity)).thenReturn(saved);
        when(usuarioMapper.toDto(saved)).thenReturn(expectedDto);

        UsuarioResponseDTO result = usuarioService.crear(request);

        assertThat(result.getIdUsuario()).isEqualTo(1L);
        verify(passwordEncoder).encode("secreto123");
        verify(usuarioRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_username_ya_existe() {
        when(usuarioRepository.existsByUsername("juan")).thenReturn(true);

        assertThatThrownBy(() -> usuarioService.crear(request()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("juan");
        verifyNoInteractions(passwordEncoder, usuarioMapper);
    }

    @Test
    void crear_lanza_excepcion_si_email_ya_existe() {
        when(usuarioRepository.existsByUsername("juan")).thenReturn(false);
        when(usuarioRepository.existsByEmail("juan@mail.com")).thenReturn(true);

        assertThatThrownBy(() -> usuarioService.crear(request()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("juan@mail.com");
        verifyNoInteractions(passwordEncoder, usuarioMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(1L);
        usuario.setEstado("ACTIVO");

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));

        usuarioService.desactivar(1L);

        assertThat(usuario.getEstado()).isEqualTo("INACTIVO");
        verify(usuarioRepository).save(usuario);
    }

    @Test
    void asignarRol_agrega_rol_al_usuario() {
        Rol rol = new Rol();
        rol.setIdRol(5L);
        rol.setNombre("CAJERO");

        Usuario usuario = new Usuario();
        usuario.setIdUsuario(1L);
        usuario.setRoles(new HashSet<>());

        UsuarioResponseDTO expectedDto = new UsuarioResponseDTO();
        expectedDto.setIdUsuario(1L);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
        when(rolRepository.findById(5L)).thenReturn(Optional.of(rol));
        when(usuarioRepository.save(usuario)).thenReturn(usuario);
        when(usuarioMapper.toDto(usuario)).thenReturn(expectedDto);

        usuarioService.asignarRol(1L, 5L);

        assertThat(usuario.getRoles()).contains(rol);
        verify(usuarioRepository).save(usuario);
    }

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    private UsuarioRequestDTO request() {
        UsuarioRequestDTO dto = new UsuarioRequestDTO();
        dto.setUsername("juan");
        dto.setEmail("juan@mail.com");
        dto.setPassword("secreto123");
        dto.setEstado("ACTIVO");
        return dto;
    }
}
