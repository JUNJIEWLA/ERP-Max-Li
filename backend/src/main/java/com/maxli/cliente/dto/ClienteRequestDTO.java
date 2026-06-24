package com.maxli.cliente.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ClienteRequestDTO {

    @NotBlank(message = "El nombre del cliente es obligatorio")
    @Size(max = 200, message = "El nombre no puede superar 200 caracteres")
    private String nombreCompleto;

    @Size(max = 20, message = "El RNC/Cédula no puede superar 20 caracteres")
    private String rncCedula;

    @Size(max = 30, message = "El teléfono no puede superar 30 caracteres")
    private String telefono;

    @Email(message = "El email no tiene un formato válido")
    @Size(max = 150, message = "El email no puede superar 150 caracteres")
    private String email;

    @Size(max = 300, message = "La dirección no puede superar 300 caracteres")
    private String direccion;

    /**
     * Código del comprobante fiscal preferido.
     * Valores válidos: B01 (Crédito Fiscal), B02 (Consumidor Final),
     * B14 (Régimen Especial), B15 (Gubernamental).
     * Por defecto: B02.
     */
    @Pattern(regexp = "^(B01|B02|B14|B15)$",
             message = "El tipo NCF debe ser B01, B02, B14 o B15")
    private String tipoNcfPreferido = "B02";

    @DecimalMin(value = "0.00", message = "El descuento no puede ser negativo")
    @DecimalMax(value = "100.00", message = "El descuento no puede superar 100%")
    private BigDecimal descuentoPredeterminado = BigDecimal.ZERO;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";

    /**
     * Días de plazo de crédito. 0 por defecto (sin crédito).
     * Junto con montoLimiteCredito deben ser > 0 para activar el crédito.
     */
    @Min(value = 0, message = "Los días de crédito no pueden ser negativos")
    private Integer diasCredito = 0;

    /**
     * Monto máximo de crédito en DOP. 0 por defecto (sin crédito).
     * Junto con diasCredito debe ser > 0 para activar el crédito.
     */
    @DecimalMin(value = "0.00", message = "El límite de crédito no puede ser negativo")
    private BigDecimal montoLimiteCredito = BigDecimal.ZERO;
}
