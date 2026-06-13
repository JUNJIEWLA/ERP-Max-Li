package com.maxli.producto.repository;

import com.maxli.producto.entity.HistorialCosto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HistorialCostoRepository extends JpaRepository<HistorialCosto, Long> {

    Page<HistorialCosto> findByProducto_IdProductoOrderByFechaRegistroDesc(Long idProducto, Pageable pageable);
}
