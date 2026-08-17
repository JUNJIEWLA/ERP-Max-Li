package com.maxli.devolucion.entity;

import com.maxli.almacen.entity.Almacen;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.usuario.entity.Usuario;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Devolución confirmada de una venta, con su Nota de Crédito B04.
 * <p>
 * Guarda los datos fiscales de la venta original (NCF afectado, número de
 * control, cliente) como copia y no como referencia viva: una nota de crédito
 * tiene que poder auditarse aunque el cliente cambie de nombre o de RNC después.
 */
@Entity
@Table(name = "devolucion")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class Devolucion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_devolucion")
    private Long idDevolucion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_venta", nullable = false)
    private Venta venta;

    /** Turno en el que se entregó el reembolso (no necesariamente el de la venta). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_turno_caja", nullable = false)
    private TurnoCaja turnoCaja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    /** Almacén de la venta original: la mercancía vuelve de donde salió. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_almacen", nullable = false)
    private Almacen almacen;

    @Column(name = "numero_control", nullable = false, unique = true, length = 30)
    private String numeroControl;

    /**
     * Llave de idempotencia que envía el cliente. Un reintento o un doble clic
     * repite la misma referencia y choca contra el índice único, así que la
     * transacción entera revierte en vez de duplicar la devolución.
     */
    @Column(name = "referencia_operacion", nullable = false, unique = true, length = 80)
    private String referenciaOperacion;

    @Column(name = "motivo", nullable = false, length = 300)
    private String motivo;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "CONFIRMADA";

    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_reembolso", nullable = false, length = 20)
    private MetodoPago metodoReembolso;

    // ── Comprobante emitido y comprobante afectado ───────────────────────

    @Column(name = "ncf", nullable = false, unique = true, length = 20)
    private String ncf;

    @Column(name = "tipo_ncf", nullable = false, length = 10)
    private String tipoNcf = "B04";

    @Column(name = "ncf_afectado", nullable = false, length = 20)
    private String ncfAfectado;

    @Column(name = "tipo_ncf_afectado", length = 10)
    private String tipoNcfAfectado;

    @Column(name = "numero_control_venta", nullable = false, length = 30)
    private String numeroControlVenta;

    @Column(name = "nombre_cliente", length = 200)
    private String nombreCliente;

    @Column(name = "rnc_cliente", length = 20)
    private String rncCliente;

    // ── Totales acreditados ──────────────────────────────────────────────

    @Column(name = "base_imponible", nullable = false, precision = 14, scale = 2)
    private BigDecimal baseImponible = BigDecimal.ZERO;

    @Column(name = "itbis", nullable = false, precision = 14, scale = 2)
    private BigDecimal itbis = BigDecimal.ZERO;

    @Column(name = "total", nullable = false, precision = 14, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    /** Saldo disponible de la Nota de Crédito para pagar compras futuras. */
    @Column(name = "monto_disponible", nullable = false, precision = 14, scale = 2)
    private BigDecimal montoDisponible = BigDecimal.ZERO;

    /** Monto acumulado consumido de esta Nota de Crédito. */
    @Column(name = "monto_usado", nullable = false, precision = 14, scale = 2)
    private BigDecimal montoUsado = BigDecimal.ZERO;

    @Column(name = "fecha_devolucion", nullable = false)
    private LocalDateTime fechaDevolucion;

    @OneToMany(mappedBy = "devolucion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetalleDevolucion> detalles = new ArrayList<>();

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;

    public void addDetalle(DetalleDevolucion detalle) {
        detalles.add(detalle);
        detalle.setDevolucion(this);
    }
}
