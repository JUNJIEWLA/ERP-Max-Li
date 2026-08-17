package com.maxli.caja.entity;

import com.maxli.usuario.entity.Usuario;
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
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "turno_caja")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class TurnoCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_turno_caja")
    private Long idTurnoCaja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_caja", nullable = false)
    private Caja caja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario_apertura", nullable = false)
    private Usuario usuarioApertura;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario_cierre")
    private Usuario usuarioCierre;

    @Column(name = "monto_inicial", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoInicial;

    @Column(name = "monto_final_declarado", precision = 12, scale = 2)
    private BigDecimal montoFinalDeclarado;

    @Column(name = "total_ventas_efectivo", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVentasEfectivo = BigDecimal.ZERO;

    @Column(name = "total_ventas_tarjeta", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVentasTarjeta = BigDecimal.ZERO;

    @Column(name = "total_ventas_transferencia", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVentasTransferencia = BigDecimal.ZERO;

    @Column(name = "total_ventas_cheque", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVentasCheque = BigDecimal.ZERO;

    @Column(name = "total_ventas_cupon", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVentasCupon = BigDecimal.ZERO;

    @Column(name = "total_otros_ingresos", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalOtrosIngresos = BigDecimal.ZERO;

    @Column(name = "total_egresos", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalEgresos = BigDecimal.ZERO;

    /**
     * Efectivo devuelto a clientes durante el turno (notas de crédito B04
     * reembolsadas en efectivo). Baja el monto esperado del cierre: ese dinero
     * salió del cajón. Los reembolsos por tarjeta, transferencia o cheque no
     * entran aquí porque no tocan el efectivo físico.
     */
    @Column(name = "total_devoluciones_efectivo", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalDevolucionesEfectivo = BigDecimal.ZERO;

    @Column(name = "monto_esperado", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoEsperado = BigDecimal.ZERO;

    @Column(name = "diferencia", precision = 12, scale = 2)
    private BigDecimal diferencia;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado;

    @Column(name = "observacion_apertura", length = 500)
    private String observacionApertura;

    @Column(name = "observacion_cierre", length = 500)
    private String observacionCierre;

    @Column(name = "fecha_apertura", nullable = false, updatable = false)
    private LocalDateTime fechaApertura;

    @Column(name = "fecha_cierre")
    private LocalDateTime fechaCierre;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
