package com.maxli.producto.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ProductoRequestDTO {

    @NotBlank(message = "El codigo es obligatorio")
    @Size(max = 50, message = "El codigo no puede superar 50 caracteres")
    private String codigo;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 150, message = "El nombre no puede superar 150 caracteres")
    private String nombre;

    @Size(max = 500, message = "La descripcion no puede superar 500 caracteres")
    private String descripcion;

    @NotNull(message = "El precio de venta es obligatorio")
    @DecimalMin(value = "0.00", message = "El precio de venta no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El precio de venta debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal precioVenta;

    @NotNull(message = "El costo es obligatorio")
    @DecimalMin(value = "0.00", message = "El costo no puede ser negativo")
    @Digits(integer = 10, fraction = 2, message = "El costo debe tener maximo 10 enteros y 2 decimales")
    private BigDecimal costo;

    @Pattern(regexp = "^(ACTIVO|INACTIVO)$", message = "El estado debe ser ACTIVO o INACTIVO")
    private String estado = "ACTIVO";

    @NotNull(message = "La categoria es obligatoria")
    private Long idCategoria;

    @NotNull(message = "La marca es obligatoria")
    private Long idMarca;
}
