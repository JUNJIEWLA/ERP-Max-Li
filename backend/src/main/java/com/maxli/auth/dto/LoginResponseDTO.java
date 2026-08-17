package com.maxli.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Set;

/**
 * Respuesta del login. <b>No contiene el token</b>: el JWT viaja en la cookie
 * {@code HttpOnly} de sesión, fuera del alcance del JavaScript de la página
 * (ISSUE-010).
 */
@Getter
@AllArgsConstructor
public class LoginResponseDTO {

    private String username;
    private String email;
    private Set<String> roles;
    private Set<String> permisos;

    /** Vigencia real del token, tomada de la configuración (jwt.expiration). */
    private long expiresIn;

    private boolean requiereCambioPassword;
}
