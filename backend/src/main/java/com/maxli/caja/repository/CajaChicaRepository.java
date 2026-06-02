package com.maxli.caja.repository;

import com.maxli.caja.entity.CajaChica;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CajaChicaRepository extends JpaRepository<CajaChica, Long> {

    Page<CajaChica> findByEstado(String estado, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CajaChica c where c.idCajaChica = :idCajaChica")
    Optional<CajaChica> findByIdForUpdate(@Param("idCajaChica") Long idCajaChica);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdCajaChicaNot(String nombre, Long idCajaChica);
}
