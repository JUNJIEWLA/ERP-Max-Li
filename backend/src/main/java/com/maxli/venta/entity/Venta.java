package com.maxli.venta.entity;

import com.maxli.almacen.entity.Almacen;
import com.maxli.caja.entity.TurnoCaja;
import com.maxli.cliente.entity.Cliente;
import com.maxli.usuario.entity.Usuario;
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

@Entity
@Table(name = "venta")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class Venta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_venta")
    private Long idVenta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_turno_caja", nullable = false)
    private TurnoCaja turnoCaja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    // Almacén del que se descontó existencia (derivado de la caja del turno).
    // Nullable en BD para no reescribir ventas históricas anteriores a ISSUE-007.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_almacen")
    private Almacen almacen;

    // ── Cliente registrado (opcional) ────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cliente")
    private Cliente cliente;

    // ── Cliente de paso: nombre + RNC temporal ───────────────────────────

    @Column(name = "nombre_cliente_temporal", length = 200)
    private String nombreClienteTemporal;

    @Column(name = "rnc_temporal", length = 20)
    private String rncTemporal;

    // ── Numeración ───────────────────────────────────────────────────────

    @Column(name = "numero_control", nullable = false, unique = true, length = 30)
    private String numeroControl;

    @Column(name = "ncf", length = 20)
    private String ncf;

    @Column(name = "tipo_ncf", length = 10)
    private String tipoNcf;

    // ── Método de pago ───────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_pago_principal", nullable = false, length = 20)
    private MetodoPago metodoPagoPrincipal;

    @Column(name = "usa_precio_mayor", nullable = false)
    private boolean usaPrecioMayor;

    // ── Totales financieros ──────────────────────────────────────────────

    @Column(name = "subtotal", nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "descuento_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal descuentoTotal = BigDecimal.ZERO;

    @Column(name = "itbis", nullable = false, precision = 14, scale = 2)
    private BigDecimal itbis = BigDecimal.ZERO;

    @Column(name = "total", nullable = false, precision = 14, scale = 2)
    private BigDecimal total;

    @Column(name = "monto_recibido", precision = 14, scale = 2)
    private BigDecimal montoRecibido;

    @Column(name = "cambio", precision = 14, scale = 2)
    private BigDecimal cambio;

    // ── Cupón ────────────────────────────────────────────────────────────

    @Column(name = "codigo_cupon", length = 50)
    private String codigoCupon;

    @Column(name = "descuento_cupon", precision = 14, scale = 2)
    private BigDecimal descuentoCupon = BigDecimal.ZERO;

    // ── Estado ───────────────────────────────────────────────────────────

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "COMPLETADA";

    @Column(name = "fecha_venta", nullable = false)
    private LocalDateTime fechaVenta;

    // ── Relaciones ───────────────────────────────────────────────────────

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetalleVenta> detalles = new ArrayList<>();

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IngresoVenta> ingresos = new ArrayList<>();

    // ── Auditoría ────────────────────────────────────────────────────────

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;

    // ── Helpers ──────────────────────────────────────────────────────────

    public void addDetalle(DetalleVenta detalle) {
        detalles.add(detalle);
        detalle.setVenta(this);
    }

    public void addIngreso(IngresoVenta ingreso) {
        ingresos.add(ingreso);
        ingreso.setVenta(this);
    }
}
