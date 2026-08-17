package com.maxli.auth.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.Set;

/**
 * Sesión vigente del usuario autenticado.
 *
 * <p>Incluye identidad además de permisos porque, con el token en una cookie
 * {@code HttpOnly}, el SPA no tiene otra forma de saber quién es al recargar.
 */
@Getter
@Setter
public class MeResponseDTO {

    private String username;
    private String email;
    private Set<String> permisos;
    private Set<String> roles;
    private int tokenVersion;
    private boolean requiereCambioPassword;
}
