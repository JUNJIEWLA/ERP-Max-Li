package com.maxli.usuario.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

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

    @NotBlank(message = "La contrasena es obligatoria")
    @Size(min = 8, message = "La contrasena debe tener al menos 8 caracteres")
    private String password;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";
}
