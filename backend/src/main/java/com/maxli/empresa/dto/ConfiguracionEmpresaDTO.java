package com.maxli.empresa.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * DTO de lectura y escritura para la configuración de empresa.
 *
 * <p>Se usa tanto para la respuesta del GET como para el cuerpo del PUT.
 * Los campos son opcionales en conjunto (la empresa puede guardar a medias),
 * pero cuando se envía un valor se valida su formato.
 */
@Getter
@Setter
@NoArgsConstructor
public class ConfiguracionEmpresaDTO {

    // ── Datos fiscales ──────────────────────────────────────────────

    @Size(max = 200, message = "El nombre comercial no puede superar 200 caracteres")
    private String nombreComercial;

    @Size(max = 200, message = "La razón social no puede superar 200 caracteres")
    private String razonSocial;

    /**
     * RNC sin guiones. 9 dígitos para persona jurídica, 11 para persona física.
     * Se acepta vacío (sin configurar).
     */
    @Pattern(
        regexp = "^(\\d{9}|\\d{11})?$",
        message = "El RNC debe tener exactamente 9 dígitos (persona jurídica) o 11 (persona física), sin guiones"
    )
    private String rnc;

    // ── Contacto ────────────────────────────────────────────────────

    @Size(max = 30, message = "El teléfono principal no puede superar 30 caracteres")
    private String telefonoPrincipal;

    @Size(max = 30, message = "El teléfono secundario no puede superar 30 caracteres")
    private String telefonoSecundario;

    @Email(message = "El email comercial no tiene un formato válido")
    @Size(max = 150, message = "El email comercial no puede superar 150 caracteres")
    private String emailComercial;

    @Email(message = "El email de facturación no tiene un formato válido")
    @Size(max = 150, message = "El email de facturación no puede superar 150 caracteres")
    private String emailFacturacion;

    // ── Dirección ───────────────────────────────────────────────────

    @Size(max = 500, message = "La dirección no puede superar 500 caracteres")
    private String direccion;

    @Size(max = 100, message = "La ciudad no puede superar 100 caracteres")
    private String ciudad;

    @Size(max = 100, message = "La provincia no puede superar 100 caracteres")
    private String provincia;

    @Size(max = 100, message = "El país no puede superar 100 caracteres")
    private String pais;

    // ── Presencia digital ───────────────────────────────────────────

    @Size(max = 255, message = "El sitio web no puede superar 255 caracteres")
    private String sitioWeb;

    @Size(max = 500, message = "La URL del logo no puede superar 500 caracteres")
    private String logoUrl;

    // ── Términos y políticas ────────────────────────────────────────

    @Size(max = 2000, message = "La política de devolución no puede superar 2000 caracteres")
    private String politicaDevolucion;

    // ── Auditoría (solo lectura: ignorado en PUT) ────────────────────

    private LocalDateTime fechaModificacion;
}
