package com.maxli.cliente.entity;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cliente")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cliente")
    private Long idCliente;

    @Column(name = "nombre_completo", nullable = false, length = 200)
    private String nombreCompleto;

    @Column(name = "rnc_cedula", length = 20)
    private String rncCedula;

    @Column(name = "telefono", length = 30)
    private String telefono;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "direccion", length = 300)
    private String direccion;

    /** Código NCF preferido: B01, B02, B14, B15. Por defecto B02 (Consumidor Final). */
    @Column(name = "tipo_ncf_preferido", nullable = false, length = 10)
    private String tipoNcfPreferido = "B02";

    /** Porcentaje de descuento predeterminado (0–100). */
    @Column(name = "descuento_predeterminado", nullable = false, precision = 5, scale = 2)
    private BigDecimal descuentoPredeterminado = BigDecimal.ZERO;

    /** Monto acumulado total de compras del cliente. Se incrementa en cada venta. */
    @Column(name = "total_compras", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalCompras = BigDecimal.ZERO;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "ACTIVO";

    /**
     * Días de plazo de crédito otorgados al cliente.
     * 0 = sin crédito. Se activa cuando AMBOS (diasCredito y montoLimiteCredito) son > 0.
     */
    @Column(name = "dias_credito", nullable = false)
    private Integer diasCredito = 0;

    /**
     * Monto máximo de crédito autorizado en DOP.
     * 0 = sin crédito. Se activa cuando AMBOS (diasCredito y montoLimiteCredito) son > 0.
     */
    @Column(name = "monto_limite_credito", nullable = false, precision = 14, scale = 2)
    private BigDecimal montoLimiteCredito = BigDecimal.ZERO;

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
