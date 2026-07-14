package com.maxli.cupon.repository;

import com.maxli.cupon.entity.Cupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface CuponRepository extends JpaRepository<Cupon, Long> {

    Page<Cupon> findByEstado(String estado, Pageable pageable);

    boolean existsByCodigoSecreto(String codigoSecreto);
    boolean existsByCodigoSecretoAndIdCuponNot(String codigoSecreto, Long idCupon);

    /**
     * Busca un cupón activo por su código secreto para aplicarlo en el POS.
     * Trae las categorías en la misma consulta para evitar N+1.
     */
    @Query("""
            SELECT c FROM Cupon c
            LEFT JOIN FETCH c.categorias
            WHERE c.codigoSecreto = :codigo
            """)
    Optional<Cupon> findByCodigoSecretoWithCategorias(@Param("codigo") String codigo);

    @Query("""
            SELECT c FROM Cupon c
            WHERE c.estado = 'ACTIVO'
              AND c.fechaInicio <= :hoy
              AND (c.fechaFin IS NULL OR c.fechaFin >= :hoy)
            """)
    Page<Cupon> findVigentes(@Param("hoy") LocalDate hoy, Pageable pageable);

    /** Obtiene el siguiente número correlativo para el codigoInterno. */
    @Query("SELECT COUNT(c) FROM Cupon c")
    long contarTodos();
}
