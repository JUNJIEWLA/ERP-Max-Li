package com.maxli.caja.repository;

import com.maxli.caja.entity.TurnoCaja;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TurnoCajaRepository extends JpaRepository<TurnoCaja, Long> {

    Page<TurnoCaja> findByEstado(String estado, Pageable pageable);

    Optional<TurnoCaja> findByCaja_IdCajaAndEstado(Long idCaja, String estado);

    Optional<TurnoCaja> findByUsuarioApertura_UsernameAndEstado(String username, String estado);

    boolean existsByCaja_IdCajaAndEstado(Long idCaja, String estado);

    boolean existsByUsuarioApertura_UsernameAndEstado(String username, String estado);
}
