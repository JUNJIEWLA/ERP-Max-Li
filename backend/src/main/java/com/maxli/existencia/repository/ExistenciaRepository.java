package com.maxli.existencia.repository;

import com.maxli.existencia.entity.Existencia;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExistenciaRepository extends JpaRepository<Existencia, Long> {

    List<Existencia> findByProducto_IdProducto(Long idProducto);

    Optional<Existencia> findFirstByProducto_IdProducto(Long idProducto);

    Optional<Existencia> findByProducto_IdProductoAndAlmacen_IdAlmacen(Long idProducto, Long idAlmacen);

    @Query("SELECT e FROM Existencia e WHERE e.cantidadActual < e.cantidadMinima")
    Page<Existencia> findBajoStock(Pageable pageable);

    boolean existsByProducto_IdProducto(Long idProducto);

    boolean existsByProducto_IdProductoAndAlmacen_IdAlmacen(Long idProducto, Long idAlmacen);

    Page<Existencia> findByAlmacen_IdAlmacen(Long idAlmacen, Pageable pageable);

    @Query("SELECT e FROM Existencia e WHERE e.almacen.idAlmacen = :idAlmacen AND e.cantidadActual < e.cantidadMinima")
    Page<Existencia> findBajoStockByAlmacen(@Param("idAlmacen") Long idAlmacen, Pageable pageable);
}
