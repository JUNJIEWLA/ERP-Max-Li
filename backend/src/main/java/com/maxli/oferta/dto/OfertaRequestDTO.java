package com.maxli.oferta.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class OfertaRequestDTO {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
    private String nombre;

    @Size(max = 255, message = "La descripcion no puede superar 255 caracteres")
    private String descripcion;

    @NotBlank(message = "El tipo es obligatorio")
    @Pattern(regexp = "^(CANTIDAD|DESCUENTO)$", message = "El tipo debe ser CANTIDAD o DESCUENTO")
    private String tipo;

    @NotNull(message = "El producto es obligatorio")
    private Long idProducto;

    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate fechaInicio;

    private LocalDate fechaFin;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";

    @Min(value = 2, message = "La cantidad requerida debe ser al menos 2")
    private Integer cantidadRequerida;

    @Min(value = 1, message = "La cantidad pagada debe ser al menos 1")
    private Integer cantidadPagada;

    @DecimalMin(value = "0.01", message = "El descuento debe ser mayor que 0")
    @DecimalMax(value = "100.00", message = "El descuento no puede superar 100%")
    @Digits(integer = 3, fraction = 2, message = "El descuento debe tener maximo 3 enteros y 2 decimales")
    private BigDecimal porcentajeDescuento;
}
