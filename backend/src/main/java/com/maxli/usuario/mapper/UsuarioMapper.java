package com.maxli.usuario.mapper;

import com.maxli.usuario.dto.UsuarioRequestDTO;
import com.maxli.usuario.dto.UsuarioResponseDTO;
import com.maxli.usuario.entity.Usuario;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class UsuarioMapper {

    public Usuario toEntity(UsuarioRequestDTO dto, String passwordHash) {
        Usuario usuario = new Usuario();
        usuario.setUsername(dto.getUsername());
        usuario.setEmail(dto.getEmail());
        usuario.setPasswordHash(passwordHash);
        usuario.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        return usuario;
    }

    public UsuarioResponseDTO toDto(Usuario usuario) {
        UsuarioResponseDTO dto = new UsuarioResponseDTO();
        dto.setIdUsuario(usuario.getIdUsuario());
        dto.setUsername(usuario.getUsername());
        dto.setEmail(usuario.getEmail());
        dto.setEstado(usuario.getEstado());
        dto.setRoles(
                usuario.getRoles().stream()
                        .map(rol -> rol.getNombre())
                        .collect(Collectors.toSet())
        );
        dto.setFechaCreacion(usuario.getFechaCreacion());
        dto.setFechaModificacion(usuario.getFechaModificacion());
        return dto;
    }
}
