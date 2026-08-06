package com.maxli.venta.repository;

import com.maxli.venta.entity.Venta;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VentaRepository extends JpaRepository<Venta, Long> {

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
}
