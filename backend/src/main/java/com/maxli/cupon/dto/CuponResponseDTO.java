package com.maxli.cupon.dto;

import com.maxli.cupon.entity.TipoDescuento;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CuponResponseDTO {
    private Long idCupon;
    private String codigoInterno;
    private String codigoSecreto;
    private TipoDescuento tipoDescuento;
    private BigDecimal valorDescuento;
    private boolean aplicaTodasCategorias;
    private List<CategoriaSimpleDTO> categorias;
    private BigDecimal montoMinimoCompra;
    private LocalDate fechaInicio;
    private LocalDate fechaFin;
    private Integer limiteUsos;
    private Integer usosActuales;
    private String estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaModificacion;

    @Data
    public static class CategoriaSimpleDTO {
        private Long idCategoria;
        private String nombre;
    }
}
