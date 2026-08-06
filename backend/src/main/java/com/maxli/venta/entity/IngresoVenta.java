package com.maxli.venta.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/**
 * Cada registro representa un pago parcial dentro de una venta.
 * Una venta MIXTA tendrá múltiples {@code IngresoVenta}, uno por cada método usado.
 */
@Entity
@Table(name = "ingreso_venta")
@Getter
@Setter
@NoArgsConstructor
public class IngresoVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ingreso_venta")
    private Long idIngresoVenta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_venta", nullable = false)
    private Venta venta;

    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_pago", nullable = false, length = 20)
    private MetodoPago metodoPago;

    @Column(name = "monto", nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    /** Número de referencia (tarjeta, transferencia, cheque). */
    @Column(name = "referencia", length = 100)
    private String referencia;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;
}
