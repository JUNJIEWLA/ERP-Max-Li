package com.maxli.compra.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProveedorRequestDTO {

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    @Size(max = 200, message = "El nombre no puede superar 200 caracteres")
    private String nombreEmpresa;

    @NotBlank(message = "El RNC es obligatorio")
    @Size(max = 20, message = "El RNC no puede superar 20 caracteres")
    private String rnc;

    @Size(max = 300, message = "La ubicación no puede superar 300 caracteres")
    private String ubicacion;

    @Size(max = 100, message = "El nombre del vendedor no puede superar 100 caracteres")
    private String vendedor;

    @Size(max = 30, message = "El teléfono no puede superar 30 caracteres")
    private String telefono;

    @Email(message = "El email no tiene un formato válido")
    @Size(max = 150, message = "El email no puede superar 150 caracteres")
    private String email;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";
}
