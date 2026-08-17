package com.maxli.caja.repository;

import com.maxli.caja.entity.TurnoCaja;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TurnoCajaRepository extends JpaRepository<TurnoCaja, Long> {

    /**
     * Carga el turno tomando bloqueo pesimista de fila.
     * <p>
     * Venta, devolución y cierre leen el turno, calculan el cuadre y lo vuelven
     * a guardar. Sin bloqueo eso es un check-then-act: una devolución puede
     * validar el turno como ABIERTO, quedarse esperando por otra cosa, y guardar
     * después su copia vieja —reabriendo un turno ya cerrado o pisando
     * montoEsperado y totalDevolucionesEfectivo. Quien vaya a escribir el turno
     * lo adquiere por aquí y revalida el estado con la fila ya bloqueada.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TurnoCaja t WHERE t.idTurnoCaja = :id")
    Optional<TurnoCaja> bloquearPorId(@Param("id") Long id);

    Page<TurnoCaja> findByEstado(String estado, Pageable pageable);

    Optional<TurnoCaja> findByCaja_IdCajaAndEstado(Long idCaja, String estado);

    Optional<TurnoCaja> findByUsuarioApertura_UsernameAndEstado(String username, String estado);

    boolean existsByCaja_IdCajaAndEstado(Long idCaja, String estado);

    boolean existsByUsuarioApertura_UsernameAndEstado(String username, String estado);
}
