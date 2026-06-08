package com.maxli.inventario.repository;

import com.maxli.inventario.entity.Movimiento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MovimientoRepository extends JpaRepository<Movimiento, Long> {

    Page<Movimiento> findByTipo(String tipo, Pageable pageable);

    @Query("SELECT m FROM Movimiento m WHERE m.almacenOrigen.idAlmacen = :idAlmacen OR m.almacenDestino.idAlmacen = :idAlmacen")
    Page<Movimiento> findByAlmacen(@Param("idAlmacen") Long idAlmacen, Pageable pageable);

    Page<Movimiento> findByEstado(String estado, Pageable pageable);
}
