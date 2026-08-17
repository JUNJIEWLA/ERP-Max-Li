package com.maxli.devolucion.entity;

import com.maxli.producto.entity.Producto;
import com.maxli.venta.entity.DetalleVenta;
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

/**
 * Línea acreditada de una devolución.
 * <p>
 * Todos los importes son snapshots calculados desde la línea de venta original
 * ({@link DetalleVenta}), nunca desde el precio o la tasa vigentes del producto:
 * una nota de crédito acredita lo que se cobró, no lo que costaría hoy.
 */
@Entity
@Table(name = "detalle_devolucion")
@Getter
@Setter
@NoArgsConstructor
public class DetalleDevolucion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_devolucion")
    private Long idDetalleDevolucion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_devolucion", nullable = false)
    private Devolucion devolucion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_detalle_venta", nullable = false)
    private DetalleVenta detalleVenta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_producto", nullable = false)
    private Producto producto;

    @Column(name = "cantidad", nullable = false)
    private Integer cantidad;

    /** Precio unitario efectivamente cobrado en la venta. */
    @Column(name = "precio_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioUnitario;

    /** Tasa de ITBIS con la que se facturó la línea. */
    @Column(name = "tasa_itbis", nullable = false, precision = 5, scale = 2)
    private BigDecimal tasaItbis;

    /** Parte del descuento global/cupón de la venta que corresponde a lo devuelto. */
    @Column(name = "descuento_acreditado", nullable = false, precision = 14, scale = 2)
    private BigDecimal descuentoAcreditado = BigDecimal.ZERO;

    /** {@code base + itbis + descuento}: el importe bruto de línea devuelto. */
    @Column(name = "importe_acreditado", nullable = false, precision = 14, scale = 2)
    private BigDecimal importeAcreditado = BigDecimal.ZERO;

    @Column(name = "base_imponible_acreditada", nullable = false, precision = 14, scale = 2)
    private BigDecimal baseImponibleAcreditada = BigDecimal.ZERO;

    @Column(name = "itbis_acreditado", nullable = false, precision = 14, scale = 2)
    private BigDecimal itbisAcreditado = BigDecimal.ZERO;
}
