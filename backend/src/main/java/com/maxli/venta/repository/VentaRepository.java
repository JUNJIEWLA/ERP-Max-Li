package com.maxli.venta.repository;

import com.maxli.venta.dto.VentaResumenDTO;
import com.maxli.venta.entity.MetodoPago;
import com.maxli.venta.entity.Venta;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface VentaRepository extends JpaRepository<Venta, Long> {

    /**
     * Página del Historial de Ventas, ya filtrada y proyectada por la base.
     * <p>
     * Cada parámetro nulo desactiva su propio filtro, así que los criterios se
     * combinan sin construir SQL a mano. La proyección a
     * {@link com.maxli.venta.dto.VentaResumenDTO} evita traer detalles e
     * ingresos —que la tabla no muestra— y el {@code JOIN} con usuario y
     * cliente resuelve en la misma consulta lo único que sí se muestra de
     * ellos, sin una query extra por fila.
     * <p>
     * {@code q} se espera ya en minúsculas y envuelto en {@code %}.
     */
    @Query(value = """
            SELECT new com.maxli.venta.dto.VentaResumenDTO(
                       v.idVenta, v.numeroControl, v.fechaVenta, v.ncf, v.tipoNcf,
                       COALESCE(c.nombreCompleto, v.nombreClienteTemporal),
                       u.username, v.metodoPagoPrincipal, v.total, v.estado)
            FROM Venta v
            JOIN v.usuario u
            LEFT JOIN v.cliente c
            WHERE (:q IS NULL
                   OR LOWER(v.numeroControl) LIKE :q
                   OR LOWER(v.ncf) LIKE :q
                   OR LOWER(c.nombreCompleto) LIKE :q
                   OR LOWER(v.nombreClienteTemporal) LIKE :q)
              AND (CAST(:desde AS timestamp) IS NULL OR v.fechaVenta >= :desde)
              AND (CAST(:hasta AS timestamp) IS NULL OR v.fechaVenta <= :hasta)
              AND (:cajero IS NULL OR LOWER(u.username) = :cajero)
              AND (:metodoPago IS NULL OR v.metodoPagoPrincipal = :metodoPago)
              AND (:estado IS NULL OR v.estado = :estado)
            ORDER BY v.idVenta DESC
            """,
            countQuery = """
            SELECT COUNT(v)
            FROM Venta v
            JOIN v.usuario u
            LEFT JOIN v.cliente c
            WHERE (:q IS NULL
                   OR LOWER(v.numeroControl) LIKE :q
                   OR LOWER(v.ncf) LIKE :q
                   OR LOWER(c.nombreCompleto) LIKE :q
                   OR LOWER(v.nombreClienteTemporal) LIKE :q)
              AND (CAST(:desde AS timestamp) IS NULL OR v.fechaVenta >= :desde)
              AND (CAST(:hasta AS timestamp) IS NULL OR v.fechaVenta <= :hasta)
              AND (:cajero IS NULL OR LOWER(u.username) = :cajero)
              AND (:metodoPago IS NULL OR v.metodoPagoPrincipal = :metodoPago)
              AND (:estado IS NULL OR v.estado = :estado)
            """)
    Page<VentaResumenDTO> buscarResumen(@Param("q") String q,
                                        @Param("desde") LocalDateTime desde,
                                        @Param("hasta") LocalDateTime hasta,
                                        @Param("cajero") String cajero,
                                        @Param("metodoPago") MetodoPago metodoPago,
                                        @Param("estado") String estado,
                                        Pageable pageable);

    Page<Venta> findByEstado(String estado, Pageable pageable);

    Page<Venta> findByTurnoCaja_IdTurnoCaja(Long idTurnoCaja, Pageable pageable);

    @Query(value = "SELECT nextval('seq_numero_control_venta')", nativeQuery = true)
    Long obtenerSiguienteNumeroControl();

    @Query("""
            SELECT COALESCE(SUM(iv.monto), 0)
            FROM IngresoVenta iv
            JOIN iv.venta v
            WHERE v.turnoCaja.idTurnoCaja = :idTurno
              AND v.estado = 'COMPLETADA'
              AND iv.metodoPago = com.maxli.venta.entity.MetodoPago.EFECTIVO
            """)
    java.math.BigDecimal sumarVentasEfectivoPorTurno(@Param("idTurno") Long idTurno);

    @Query("""
            SELECT COALESCE(SUM(iv.monto), 0)
            FROM IngresoVenta iv
            JOIN iv.venta v
            WHERE v.turnoCaja.idTurnoCaja = :idTurno
              AND v.estado = 'COMPLETADA'
              AND iv.metodoPago = com.maxli.venta.entity.MetodoPago.TARJETA
            """)
    java.math.BigDecimal sumarVentasTarjetaPorTurno(@Param("idTurno") Long idTurno);

    @Query("""
            SELECT COALESCE(SUM(iv.monto), 0)
            FROM IngresoVenta iv
            JOIN iv.venta v
            WHERE v.turnoCaja.idTurnoCaja = :idTurno
              AND v.estado = 'COMPLETADA'
              AND iv.metodoPago = com.maxli.venta.entity.MetodoPago.TRANSFERENCIA
            """)
    java.math.BigDecimal sumarVentasTransferenciaPorTurno(@Param("idTurno") Long idTurno);

    @Query("""
            SELECT COALESCE(SUM(iv.monto), 0)
            FROM IngresoVenta iv
            JOIN iv.venta v
            WHERE v.turnoCaja.idTurnoCaja = :idTurno
              AND v.estado = 'COMPLETADA'
              AND iv.metodoPago = com.maxli.venta.entity.MetodoPago.CHEQUE
            """)
    java.math.BigDecimal sumarVentasChequePorTurno(@Param("idTurno") Long idTurno);

    /**
     * Cambio devuelto al cliente durante el turno.
     * <p>
     * Complementa a {@link #sumarVentasEfectivoPorTurno(Long)}: esa suma el efectivo
     * <b>recibido</b>, y el cambio es la parte que volvió a salir del cajón. El efectivo
     * que realmente permanece en caja es la diferencia entre ambos (ISSUE-006).
     */
    @Query("""
            SELECT COALESCE(SUM(v.cambio), 0)
            FROM Venta v
            WHERE v.turnoCaja.idTurnoCaja = :idTurno
              AND v.estado = 'COMPLETADA'
            """)
    java.math.BigDecimal sumarCambioEntregadoPorTurno(@Param("idTurno") Long idTurno);
}
