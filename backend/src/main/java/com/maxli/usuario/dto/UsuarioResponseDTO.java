package com.maxli.usuario.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Set;

@Getter
@Setter
public class UsuarioResponseDTO {

    private Long idUsuario;
    private String username;
    private String email;
    private String estado;
    private Set<String> roles;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
