package com.maxli.empresa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * Configuración corporativa del negocio que opera el ERP.
 *
 * <p>Singleton estricto: la base de datos garantiza que solo existe una fila
 * (id = 1 con CHECK id = 1). El servicio lee y sobreescribe siempre esa fila;
 * nunca crea nuevas.
 *
 * <p>Los datos aquí almacenados se consumen en:
 * <ul>
 *   <li>Encabezado de facturas y comprobantes impresos.</li>
 *   <li>Campo emisor en el XML 608 para la DGII.</li>
 *   <li>Remitente en correos de facturación automática.</li>
 *   <li>Reportes de cierre de turno de caja.</li>
 * </ul>
 */
@Entity
@Table(name = "configuracion_empresa")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class ConfiguracionEmpresa {

    /** Siempre 1. La DB lo garantiza con CHECK (id = 1). */
    @Id
    @Column(name = "id")
    private Long id = 1L;

    // ── Datos fiscales ──────────────────────────────────────────────

    @Column(name = "nombre_comercial", length = 200)
    private String nombreComercial;

    @Column(name = "razon_social", length = 200)
    private String razonSocial;

    /** 9 dígitos para persona jurídica, 11 para persona física. Sin guiones. */
    @Column(name = "rnc", length = 20)
    private String rnc;

    // ── Contacto ────────────────────────────────────────────────────

    @Column(name = "telefono_principal", length = 30)
    private String telefonoPrincipal;

    @Column(name = "telefono_secundario", length = 30)
    private String telefonoSecundario;

    @Column(name = "email_comercial", length = 150)
    private String emailComercial;

    /** Dirección usada como remitente en correos de comprobantes. */
    @Column(name = "email_facturacion", length = 150)
    private String emailFacturacion;

    // ── Dirección física ────────────────────────────────────────────

    @Column(name = "direccion", length = 500)
    private String direccion;

    @Column(name = "ciudad", length = 100)
    private String ciudad;

    @Column(name = "provincia", length = 100)
    private String provincia;

    @Column(name = "pais", length = 100)
    private String pais;

    // ── Presencia digital ───────────────────────────────────────────

    @Column(name = "sitio_web", length = 255)
    private String sitioWeb;

    /** URL o path al logo. La subida de archivos es una épica separada. */
    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    // ── Términos y políticas ────────────────────────────────────────

    @Column(name = "politica_devolucion", columnDefinition = "TEXT")
    private String politicaDevolucion;

    // ── Auditoría ───────────────────────────────────────────────────

    @CreatedDate
    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    @Column(name = "fecha_modificacion")
    private LocalDateTime fechaModificacion;
}
