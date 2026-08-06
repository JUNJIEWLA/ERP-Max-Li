package com.maxli.compra.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orden_compra")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class OrdenCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_orden_compra")
    private Long idOrdenCompra;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_proveedor", nullable = false)
    private Proveedor proveedor;

    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    /**
     * Estados válidos:
     * BORRADOR → ENVIADA → RECEPCION_PARCIAL → COMPLETADA
     *                    ↘ ANULADA
     */
    @Column(name = "estado", nullable = false, length = 30)
    private String estado;

    /**
     * Fecha en que el proveedor se comprometió a entregar la mercancía.
     * NULL = no se acordó fecha. Cuando está definida y la OC sigue ENVIADA o RECEPCION_PARCIAL
     * después de esta fecha, el scheduler genera una alerta de retraso en el buzón.
     */
    @Column(name = "fecha_llegada_acordada")
    private LocalDate fechaLlegadaAcordada;

    @OneToMany(mappedBy = "ordenCompra", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetalleOrdenCompra> detalles = new ArrayList<>();

    @CreatedDate
    @Column(name = "fecha_orden", updatable = false)
    private LocalDateTime fechaOrden;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
