package com.maxli.producto.repository;

import com.maxli.producto.entity.AlertaCosto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertaCostoRepository extends JpaRepository<AlertaCosto, Long> {

    Page<AlertaCosto> findByEstadoOrderByFechaCreacionDesc(String estado, Pageable pageable);

    long countByEstado(String estado);

    List<AlertaCosto> findByIdAlertaCostoIn(List<Long> ids);
}
