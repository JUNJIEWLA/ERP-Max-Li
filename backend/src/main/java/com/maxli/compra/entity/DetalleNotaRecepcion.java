package com.maxli.compra.entity;

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

@Entity
@Table(name = "detalle_nota_recepcion")
@Getter
@Setter
@NoArgsConstructor
public class DetalleNotaRecepcion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detalle_nota_recepcion")
    private Long idDetalleNotaRecepcion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_nota_recepcion", nullable = false)
    private NotaRecepcion notaRecepcion;

    /**
     * Referencia al ítem de la orden para saber qué producto
     * se está recibiendo y acumular cantidadRecibida.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_detalle_orden_compra", nullable = false)
    private DetalleOrdenCompra detalleOrdenCompra;

    @Column(name = "cantidad_recibida", nullable = false)
    private Integer cantidadRecibida;

    /**
     * Estado físico de la mercancía: CONFORME, DAÑADO, INCOMPLETO.
     * Solo los ítems CONFORME actualizan el inventario al confirmar.
     */
    @Column(name = "observacion", nullable = false, length = 50)
    private String observacion;

    @Column(name = "notas", length = 500)
    private String notas;
}
