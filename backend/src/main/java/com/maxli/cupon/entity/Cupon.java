package com.maxli.cupon.entity;

import com.maxli.producto.entity.Categoria;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "cupon")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class Cupon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cupon")
    private Long idCupon;

    /** Identificador secuencial para uso administrativo (ej. CUPON-01). */
    @Column(name = "codigo_interno", nullable = false, unique = true, length = 30)
    private String codigoInterno;

    /** Código que el cliente entrega en la caja. */
    @Column(name = "codigo_secreto", nullable = false, unique = true, length = 50)
    private String codigoSecreto;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_descuento", nullable = false, length = 20)
    private TipoDescuento tipoDescuento;

    @Column(name = "valor_descuento", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorDescuento;

    /** true = aplica a todos los productos, false = sólo a categorías en cupon_categoria. */
    @Column(name = "aplica_todas_categorias", nullable = false)
    private boolean aplicaTodasCategorias = true;

    @Column(name = "monto_minimo_compra", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoMinimoCompra = BigDecimal.ZERO;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(name = "limite_usos", nullable = false)
    private Integer limiteUsos;

    @Column(name = "usos_actuales", nullable = false)
    private Integer usosActuales = 0;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "ACTIVO";

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "cupon_categoria",
            joinColumns = @JoinColumn(name = "id_cupon"),
            inverseJoinColumns = @JoinColumn(name = "id_categoria")
    )
    private Set<Categoria> categorias = new HashSet<>();

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
