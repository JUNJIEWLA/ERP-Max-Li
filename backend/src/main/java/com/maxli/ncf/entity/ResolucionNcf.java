package com.maxli.ncf.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "resolucion_ncf")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class ResolucionNcf {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_resolucion")
    private Long idResolucion;

    @Column(name = "tipo_ncf", nullable = false, length = 10)
    private String tipoNcf; // Ej: "B01"

    @Column(name = "descripcion", nullable = false, length = 100)
    private String descripcion; // Ej: "Factura de Crédito Fiscal"

    @Column(name = "numero_resolucion", nullable = false, length = 50)
    private String numeroResolucion; // Resolución DGII

    @Column(name = "prefijo", nullable = false, length = 5)
    private String prefijo; // "B01" o "E31"

    @Column(name = "secuencia_inicio", nullable = false)
    private Long secuenciaInicio;

    @Column(name = "secuencia_final", nullable = false)
    private Long secuenciaFinal;

    @Column(name = "secuencia_actual", nullable = false)
    private Long secuenciaActual;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado; // "ACTIVO", "AGOTADO", "VENCIDO"

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
