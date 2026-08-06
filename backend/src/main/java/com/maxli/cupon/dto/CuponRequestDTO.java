package com.maxli.cupon.dto;

import com.maxli.cupon.entity.TipoDescuento;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CuponRequestDTO {

    @NotBlank(message = "El código secreto es requerido")
    @Size(max = 50)
    private String codigoSecreto;

    @NotNull(message = "El tipo de descuento es requerido")
    private TipoDescuento tipoDescuento;

    @NotNull(message = "El valor del descuento es requerido")
    @DecimalMin(value = "0.01", message = "El valor debe ser mayor a 0")
    private BigDecimal valorDescuento;

    private boolean aplicaTodasCategorias = true;

    /** Lista de IDs de categorías; se usa solo cuando aplicaTodasCategorias=false. */
    private List<Long> categoriaIds;

    @NotNull(message = "El monto mínimo es requerido")
    @DecimalMin(value = "0.00", inclusive = true)
    private BigDecimal montoMinimoCompra = BigDecimal.ZERO;

    @NotNull(message = "La fecha de inicio es requerida")
    private LocalDate fechaInicio;

    private LocalDate fechaFin;

    @NotNull(message = "El límite de usos es requerido")
    @Min(value = 1, message = "El límite de usos debe ser al menos 1")
    private Integer limiteUsos;

    @NotBlank(message = "El estado es requerido")
    private String estado;
}
