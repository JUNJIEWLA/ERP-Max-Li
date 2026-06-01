package com.maxli.caja.repository;

import com.maxli.caja.entity.CajaChica;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CajaChicaRepository extends JpaRepository<CajaChica, Long> {

    Page<CajaChica> findByEstado(String estado, Pageable pageable);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdCajaChicaNot(String nombre, Long idCajaChica);
}
