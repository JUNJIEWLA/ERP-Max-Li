package com.maxli.caja.repository;

import com.maxli.caja.entity.Caja;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CajaRepository extends JpaRepository<Caja, Long> {

    Page<Caja> findByEstado(String estado, Pageable pageable);

    boolean existsByNombreAndEstado(String nombre, String estado);
}
