package com.maxli.usuario.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

@Getter
@Setter
public class UsuarioRequestDTO {

    @NotBlank(message = "El username es obligatorio")
    @Size(max = 50, message = "El username no puede superar 50 caracteres")
    private String username;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El email debe tener un formato valido")
    @Size(max = 150, message = "El email no puede superar 150 caracteres")
    private String email;

    /** Obligatorio al crear. Opcional (null) al editar sin cambiar contraseña. */
    @Size(min = 8, message = "La contrasena debe tener al menos 8 caracteres")
    private String password;

    @Pattern(regexp = "^(ACTIVO|INACTIVO|SUSPENDIDO)$", message = "El estado debe ser ACTIVO, INACTIVO o SUSPENDIDO")
    private String estado = "ACTIVO";

    /** IDs de roles a asignar. Si es null, no se modifica la asignación. */
    private Set<Long> rolIds;

    /** IDs de permisos por excepción. Si es null, no se modifica. */
    private Set<Long> permisoExtraIds;
}
