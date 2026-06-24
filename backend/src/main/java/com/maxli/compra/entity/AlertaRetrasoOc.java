package com.maxli.compra.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
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
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * Alerta generada cuando una Orden de Compra supera su fecha de llegada acordada.
 * Una sola alerta por OC (constraint UNIQUE en id_orden_compra).
 * El scheduler usa lógica upsert: actualiza dias_retraso si ya existe, inserta si no.
 */
@Entity
@Table(name = "alerta_retraso_oc")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class AlertaRetrasoOc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_alerta_retraso")
    private Long idAlertaRetraso;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_orden_compra", nullable = false, unique = true)
    private OrdenCompra ordenCompra;

    /** Días transcurridos desde la fecha acordada. Se actualiza en cada ejecución del scheduler. */
    @Column(name = "dias_retraso", nullable = false)
    private Integer diasRetraso;

    /**
     * Estados válidos:
     * PENDIENTE → visible en el buzón del usuario.
     * LEIDA     → el usuario la descartó desde el buzón.
     */
    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
