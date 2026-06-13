package com.maxli.producto.entity;

import com.maxli.compra.entity.NotaRecepcion;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerta_costo")
@Getter
@Setter
@NoArgsConstructor
public class AlertaCosto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_alerta_costo")
    private Long idAlertaCosto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_producto", nullable = false)
    private Producto producto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_nota_recepcion", nullable = false)
    private NotaRecepcion notaRecepcion;

    @Column(name = "nombre_producto", nullable = false, length = 150)
    private String nombreProducto;

    @Column(name = "costo_anterior", nullable = false, precision = 12, scale = 2)
    private BigDecimal costoAnterior;

    @Column(name = "costo_nuevo", nullable = false, precision = 12, scale = 2)
    private BigDecimal costoNuevo;

    @Column(name = "precio_venta_actual", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioVentaActual;

    @Column(name = "precio_venta_sugerido", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioVentaSugerido;

    @Column(name = "porcentaje_variacion", nullable = false, precision = 8, scale = 2)
    private BigDecimal porcentajeVariacion;

    @Column(name = "porcentaje_margen", nullable = false, precision = 5, scale = 2)
    private BigDecimal porcentajeMargen;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    @Column(name = "fecha_resolucion")
    private LocalDateTime fechaResolucion;
}
