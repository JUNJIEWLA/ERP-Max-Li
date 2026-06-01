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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "nota_recepcion")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class NotaRecepcion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_nota_recepcion")
    private Long idNotaRecepcion;

    /**
     * Relación Many-to-One porque una OrdenCompra puede tener
     * múltiples NotasRecepcion (recepciones parciales).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_orden_compra", nullable = false)
    private OrdenCompra ordenCompra;

    /**
     * Estados: PENDIENTE → CONFIRMADA | RECHAZADA
     */
    @Column(name = "estado", nullable = false, length = 30)
    private String estado;

    @OneToMany(mappedBy = "notaRecepcion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetalleNotaRecepcion> detalles = new ArrayList<>();

    @CreatedDate
    @Column(name = "fecha_recepcion", updatable = false)
    private LocalDateTime fechaRecepcion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
