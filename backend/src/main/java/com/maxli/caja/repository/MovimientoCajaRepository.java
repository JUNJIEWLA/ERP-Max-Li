package com.maxli.caja.repository;

import com.maxli.caja.entity.MovimientoCaja;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {

    @EntityGraph(attributePaths = {"cajaChica", "usuario"})
    Page<MovimientoCaja> findByCajaChica_IdCajaChicaOrderByFechaHoraDesc(Long idCajaChica, Pageable pageable);

    @EntityGraph(attributePaths = {"cajaChica", "usuario"})
    Optional<MovimientoCaja> findByIdMovimiento(Long idMovimiento);
}
