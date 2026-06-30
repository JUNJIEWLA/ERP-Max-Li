package com.maxli.oferta.repository;

import com.maxli.oferta.entity.Oferta;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface OfertaRepository extends JpaRepository<Oferta, Long> {

    Page<Oferta> findByEstado(String estado, Pageable pageable);

    Page<Oferta> findByTipo(String tipo, Pageable pageable);

    Page<Oferta> findByProductoIdProducto(Long idProducto, Pageable pageable);

    @Query("""
            select o from Oferta o
            where o.estado = 'ACTIVO'
              and o.fechaInicio <= :fecha
              and (o.fechaFin is null or o.fechaFin >= :fecha)
            """)
    Page<Oferta> findVigentes(@Param("fecha") LocalDate fecha, Pageable pageable);

    @Query("""
            select o from Oferta o
            where o.producto.idProducto = :idProducto
              and o.estado = 'ACTIVO'
              and o.fechaInicio <= :fecha
              and (o.fechaFin is null or o.fechaFin >= :fecha)
            """)
    List<Oferta> findVigentesPorProducto(@Param("idProducto") Long idProducto, @Param("fecha") LocalDate fecha);
}
