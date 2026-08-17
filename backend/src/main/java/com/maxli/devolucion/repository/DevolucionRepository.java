package com.maxli.devolucion.repository;

import com.maxli.devolucion.entity.Devolucion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface DevolucionRepository extends JpaRepository<Devolucion, Long> {

    boolean existsByReferenciaOperacion(String referenciaOperacion);

    /**
     * Página del historial de devoluciones. {@code idVenta} nulo desactiva su
     * filtro. El orden lo fija el servidor —descendente por {@code idDevolucion},
     * que es único— para que ninguna fila se repita o desaparezca al paginar.
     */
    @Query("""
            SELECT d FROM Devolucion d
            WHERE (:idVenta IS NULL OR d.venta.idVenta = :idVenta)
            ORDER BY d.idDevolucion DESC
            """)
    Page<Devolucion> buscar(@Param("idVenta") Long idVenta, Pageable pageable);

    /**
     * Efectivo reembolsado durante el turno. Solo cuenta lo devuelto en
     * efectivo: una devolución por tarjeta o transferencia no saca dinero del
     * cajón, así que no puede bajar el monto esperado del cierre.
     */
    @Query("""
            SELECT COALESCE(SUM(d.total), 0)
            FROM Devolucion d
            WHERE d.turnoCaja.idTurnoCaja = :idTurno
              AND d.metodoReembolso = com.maxli.venta.entity.MetodoPago.EFECTIVO
            """)
    BigDecimal sumarReembolsosEfectivoPorTurno(@Param("idTurno") Long idTurno);

    @Query(value = "SELECT nextval('seq_numero_control_devolucion')", nativeQuery = true)
    Long obtenerSiguienteNumeroControl();

    @Query("""
            SELECT d FROM Devolucion d
            WHERE (LOWER(d.numeroControl) = LOWER(:numero)
               OR LOWER(d.ncf) = LOWER(:numero)
               OR LOWER(d.numeroControlVenta) = LOWER(:numero)
               OR LOWER(d.ncfAfectado) = LOWER(:numero)
               OR CAST(d.venta.idVenta AS string) = :numero)
              AND d.estado = 'CONFIRMADA'
            ORDER BY d.idDevolucion DESC
            """)
    java.util.List<Devolucion> buscarPorNumero(@Param("numero") String numero);
}
