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
    private boolean requiereCambioPassword;
    private Set<String> roles;
    private Set<Long> rolIds;
    private Set<Long> permisoExtraIds;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;
}
