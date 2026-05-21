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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
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
        validarUsernameDisponible(dto.getUsername());
        validarEmailDisponible(dto.getEmail());
        String hash = passwordEncoder.encode(dto.getPassword());
        Usuario usuario = usuarioMapper.toEntity(dto, hash);
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
            usuario.setEstado(dto.getEstado());
        }
        // La contrasena no se modifica en este endpoint
        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    @Transactional
    public void desactivar(Long id) {
        Usuario usuario = obtenerPorId(id);
        usuario.setEstado(INACTIVO);
        usuarioRepository.save(usuario);
    }

    @Transactional
    public UsuarioResponseDTO asignarRol(Long idUsuario, Long idRol) {
        Usuario usuario = obtenerPorId(idUsuario);
        Rol rol = rolRepository.findById(idRol)
                .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado con id: " + idRol));
        usuario.getRoles().add(rol);
        return usuarioMapper.toDto(usuarioRepository.save(usuario));
    }

    @Transactional
    public UsuarioResponseDTO quitarRol(Long idUsuario, Long idRol) {
        Usuario usuario = obtenerPorId(idUsuario);
        Rol rol = rolRepository.findById(idRol)
                .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado con id: " + idRol));
        usuario.getRoles().remove(rol);
        return usuarioMapper.toDto(usuarioRepository.save(usuario));
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
