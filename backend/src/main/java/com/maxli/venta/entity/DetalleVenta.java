package com.maxli.venta.entity;

import com.maxli.producto.entity.Producto;
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

@Entity
@Table(name = "detalle_venta")
@Getter
@Setter
@NoArgsConstructor
public class DetalleVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_venta")
    private Long idDetalleVenta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_venta", nullable = false)
    private Venta venta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_producto", nullable = false)
    private Producto producto;

    @Column(name = "cantidad", nullable = false)
    private Integer cantidad;

    /** Precio efectivamente aplicado (detalle o mayor). */
    @Column(name = "precio_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioUnitario;

    /** Precio original antes del recálculo (para alerta visual "cambió de X a Y"). */
    @Column(name = "precio_unitario_original", precision = 12, scale = 2)
    private BigDecimal precioUnitarioOriginal;

    /** DETALLE o MAYOR — indica qué tipo de precio se usó. */
    @Column(name = "tipo_precio", nullable = false, length = 20)
    private String tipoPrecio = "DETALLE";

    /** Snapshot de la tasa ITBIS al momento de la venta. */
    @Column(name = "tasa_itbis", nullable = false, precision = 5, scale = 2)
    private BigDecimal tasaItbis = new BigDecimal("18.00");

    @Column(name = "descuento_linea", precision = 5, scale = 2)
    private BigDecimal descuentoLinea = BigDecimal.ZERO;

    @Column(name = "descuento_oferta", precision = 12, scale = 2)
    private BigDecimal descuentoOferta = BigDecimal.ZERO;

    /** Nombre de la oferta aplicada (si la hubo). */
    @Column(name = "oferta_aplicada", length = 120)
    private String ofertaAplicada;

    /** Importe final = (precioUnitario × cantidad) - descuentos. */
    @Column(name = "importe", nullable = false, precision = 14, scale = 2)
    private BigDecimal importe;
}
