package com.maxli.usuario.service;

import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.permiso.entity.Permiso;
import com.maxli.permiso.repository.PermisoRepository;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.repository.RolRepository;
import com.maxli.usuario.dto.UsuarioRequestDTO;
import com.maxli.usuario.dto.UsuarioResponseDTO;
import com.maxli.usuario.entity.Usuario;
import com.maxli.usuario.mapper.UsuarioMapper;
import com.maxli.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PermisoRepository permisoRepository;
    private final UsuarioMapper usuarioMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Page<UsuarioResponseDTO> listar(Pageable pageable) {
        return usuarioRepository.findAll(pageable).map(usuarioMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<UsuarioResponseDTO> listarActivos(Pageable pageable) {
        return usuarioRepository.findByEstado(ACTIVO, pageable).map(usuarioMapper::toDto);
    }

    @Transactional(readOnly = true)
    public UsuarioResponseDTO buscarPorId(Long id) {
        return usuarioMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public UsuarioResponseDTO crear(UsuarioRequestDTO dto) {
        // Validar que se envió contraseña al crear
        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new BusinessException("La contraseña es obligatoria al crear un usuario");
        }

        validarUsernameDisponible(dto.getUsername());
        validarEmailDisponible(dto.getEmail());

        String hash = passwordEncoder.encode(dto.getPassword());
        Usuario usuario = usuarioMapper.toEntity(dto, hash);

        // Asignar roles
        if (dto.getRolIds() != null && !dto.getRolIds().isEmpty()) {
            Set<Rol> roles = new HashSet<>(rolRepository.findAllById(dto.getRolIds()));
            usuario.setRoles(roles);
        }

        // Asignar permisos por excepción
        if (dto.getPermisoExtraIds() != null && !dto.getPermisoExtraIds().isEmpty()) {
            Set<Permiso> permisos = permisoRepository.findByIdPermisoIn(dto.getPermisoExtraIds());
            usuario.setPermisosExtra(permisos);
        }

        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    @Transactional
    public UsuarioResponseDTO actualizar(Long id, UsuarioRequestDTO dto) {
        Usuario usuario = obtenerPorId(id);
        validarUsernameDisponibleParaActualizar(dto.getUsername(), id);
        validarEmailDisponibleParaActualizar(dto.getEmail(), id);

        usuario.setUsername(dto.getUsername());
        usuario.setEmail(dto.getEmail());
        if (dto.getEstado() != null) {
            String estadoAnterior = usuario.getEstado();
            usuario.setEstado(dto.getEstado());
            // Si se suspende o inactiva, invalidar token
            if (!dto.getEstado().equals(estadoAnterior)
                    && !ACTIVO.equals(dto.getEstado())) {
                usuario.setTokenVersion(usuario.getTokenVersion() + 1);
            }
        }

        // Actualizar contraseña si se envió
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            usuario.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
            usuario.setRequiereCambioPassword(true);
            usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        }

        // Actualizar roles si se enviaron
        if (dto.getRolIds() != null) {
            Set<Rol> roles = dto.getRolIds().isEmpty()
                    ? new HashSet<>()
                    : new HashSet<>(rolRepository.findAllById(dto.getRolIds()));
            usuario.setRoles(roles);
            // Invalidar token cuando cambian roles
            usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        }

        // Actualizar permisos por excepción si se enviaron
        if (dto.getPermisoExtraIds() != null) {
            Set<Permiso> permisos = dto.getPermisoExtraIds().isEmpty()
                    ? new HashSet<>()
                    : permisoRepository.findByIdPermisoIn(dto.getPermisoExtraIds());
            usuario.setPermisosExtra(permisos);
            usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        }

        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    @Transactional
    public void desactivar(Long id) {
        Usuario usuario = obtenerPorId(id);
        usuario.setEstado(INACTIVO);
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        usuarioRepository.save(usuario);
    }

    /**
     * Reset de contraseña por el administrador.
     * Activa la bandera requiereCambioPassword e invalida tokens.
     */
    @Transactional
    public void resetearPassword(Long id, String nuevaPassword) {
        if (nuevaPassword == null || nuevaPassword.length() < 8) {
            throw new BusinessException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        Usuario usuario = obtenerPorId(id);
        usuario.setPasswordHash(passwordEncoder.encode(nuevaPassword));
        usuario.setRequiereCambioPassword(true);
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        usuarioRepository.save(usuario);
    }

    /**
     * Cambio de contraseña propio del usuario (primer login o voluntario).
     * Valida la contraseña actual y desactiva requiereCambioPassword.
     */
    @Transactional
    public void cambiarPasswordPropia(Long idUsuario, String passwordActual, String passwordNueva) {
        if (passwordNueva == null || passwordNueva.length() < 8) {
            throw new BusinessException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        Usuario usuario = obtenerPorId(idUsuario);

        if (!passwordEncoder.matches(passwordActual, usuario.getPasswordHash())) {
            throw new BusinessException("La contraseña actual es incorrecta");
        }

        usuario.setPasswordHash(passwordEncoder.encode(passwordNueva));
        usuario.setRequiereCambioPassword(false);
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        usuarioRepository.save(usuario);
    }

    @Transactional
    public UsuarioResponseDTO asignarRol(Long idUsuario, Long idRol) {
        Usuario usuario = obtenerPorId(idUsuario);
        Rol rol = rolRepository.findById(idRol)
                .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado con id: " + idRol));
        usuario.getRoles().add(rol);
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    @Transactional
    public UsuarioResponseDTO quitarRol(Long idUsuario, Long idRol) {
        Usuario usuario = obtenerPorId(idUsuario);
        Rol rol = rolRepository.findById(idRol)
                .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado con id: " + idRol));
        usuario.getRoles().remove(rol);
        usuario.setTokenVersion(usuario.getTokenVersion() + 1);
        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    /**
     * Obtiene el tokenVersion actual de un usuario por username.
     * Usado por JwtAuthFilter para validación.
     */
    @Transactional(readOnly = true)
    public int obtenerTokenVersion(String username) {
        return usuarioRepository.findByUsername(username)
                .map(Usuario::getTokenVersion)
                .orElse(-1);
    }

    private Usuario obtenerPorId(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con id: " + id));
    }

    private void validarUsernameDisponible(String username) {
        if (usuarioRepository.existsByUsername(username)) {
            throw new DuplicateResourceException("Ya existe un usuario con username: " + username);
        }
    }

    private void validarEmailDisponible(String email) {
        if (usuarioRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Ya existe un usuario con email: " + email);
        }
    }

    private void validarUsernameDisponibleParaActualizar(String username, Long idUsuario) {
        if (usuarioRepository.existsByUsernameAndIdUsuarioNot(username, idUsuario)) {
            throw new DuplicateResourceException("Ya existe un usuario con username: " + username);
        }
    }

    private void validarEmailDisponibleParaActualizar(String email, Long idUsuario) {
        if (usuarioRepository.existsByEmailAndIdUsuarioNot(email, idUsuario)) {
            throw new DuplicateResourceException("Ya existe un usuario con email: " + email);
        }
    }
}
