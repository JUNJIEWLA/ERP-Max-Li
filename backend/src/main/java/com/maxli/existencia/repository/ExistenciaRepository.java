package com.maxli.existencia.repository;

import com.maxli.existencia.entity.Existencia;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ExistenciaRepository extends JpaRepository<Existencia, Long> {

    Optional<Existencia> findByProducto_IdProducto(Long idProducto);

    @Query("SELECT e FROM Existencia e WHERE e.cantidadActual < e.cantidadMinima")
    Page<Existencia> findBajoStock(Pageable pageable);

    boolean existsByProducto_IdProducto(Long idProducto);
}
