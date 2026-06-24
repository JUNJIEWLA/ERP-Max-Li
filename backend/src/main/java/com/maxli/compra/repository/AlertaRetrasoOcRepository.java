package com.maxli.compra.repository;

import com.maxli.compra.entity.AlertaRetrasoOc;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlertaRetrasoOcRepository extends JpaRepository<AlertaRetrasoOc, Long> {

    /** Busca la alerta existente para una OC (puede haber máximo una por el constraint UNIQUE). */
    Optional<AlertaRetrasoOc> findByOrdenCompra_IdOrdenCompra(Long idOrdenCompra);

    /** Lista paginada para el buzón del usuario (solo PENDIENTES). */
    Page<AlertaRetrasoOc> findByEstadoOrderByDiasRetrasoDesc(String estado, Pageable pageable);

    /** Cuenta las alertas PENDIENTES para el badge del Header. */
    long countByEstado(String estado);

    /** Lista por IDs para marcar como leídas en masivo. */
    List<AlertaRetrasoOc> findByIdAlertaRetrasoIn(List<Long> ids);

    /**
     * Consulta las OC en estado activo con fecha acordada que ya venció (≤ hoy),
     * uniendo con la alerta existente si la hay. Retorna IDs de OC para el scheduler.
     */
    @Query("""
            SELECT o.idOrdenCompra
            FROM OrdenCompra o
            WHERE o.estado IN ('ENVIADA', 'RECEPCION_PARCIAL')
              AND o.fechaLlegadaAcordada IS NOT NULL
              AND o.fechaLlegadaAcordada <= CURRENT_DATE
            """)
    List<Long> findIdsOrdenConRetraso();
}
