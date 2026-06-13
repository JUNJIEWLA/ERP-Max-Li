package com.maxli.conteo.entity;

import com.maxli.producto.entity.Producto;
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

import java.time.LocalDateTime;

@Entity
@Table(name = "conteo_detalle")
@Getter
@Setter
@NoArgsConstructor
public class ConteoDetalle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_conteo_detalle")
    private Long idConteoDetalle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_conteo", nullable = false)
    private ConteoCabecera conteo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_producto", nullable = false)
    private Producto producto;

    @Column(name = "cantidad_fisica", nullable = false)
    private Integer cantidadFisica;

    @Column(name = "cantidad_sistema")
    private Integer cantidadSistema;

    @Column(name = "diferencia")
    private Integer diferencia;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;
}
