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

    @Size(max = 100, message = "El código de barras no puede superar 100 caracteres")
    private String codigoBarras;

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

    /** Tasa ITBIS: 18.00 (gravado) o 0.00 (exento). Si es null, se usa 18.00 por defecto. */
    @DecimalMin(value = "0.00", message = "La tasa de ITBIS no puede ser negativa")
    @Digits(integer = 3, fraction = 2, message = "La tasa ITBIS debe tener maximo 3 enteros y 2 decimales")
    private BigDecimal tasaItbis;

    /** Cantidad mínima para activar precio al por mayor. Si es null, se usa 1 por defecto. */
    private Integer cantidadMinimaMayor;

    /** Stock mínimo requerido antes de alertar poca existencia. Si es null, se usa 5 por defecto. */
    @jakarta.validation.constraints.Min(value = 0, message = "El stock mínimo no puede ser negativo")
    private Integer stockMinimo;
}
