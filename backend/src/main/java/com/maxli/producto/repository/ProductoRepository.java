package com.maxli.producto.repository;

import com.maxli.producto.entity.Producto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    Page<Producto> findByEstado(String estado, Pageable pageable);

    Optional<Producto> findBySku(String sku);

    boolean existsBySku(String sku);

    boolean existsBySkuAndIdProductoNot(String sku, Long idProducto);

    List<Producto> findByCodigoBarras(String codigoBarras);

    /**
     * Búsqueda para el POS: filtra por nombre, SKU o código de barras (solo productos ACTIVOS).
     */
    @org.springframework.data.jpa.repository.Query("SELECT p FROM Producto p WHERE p.estado = 'ACTIVO' AND (" +
           "LOWER(p.codigoBarras) = LOWER(:q) OR " +
           "LOWER(p.sku) = LOWER(:q) OR " +
           "LOWER(p.nombre) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(p.codigoBarras) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<Producto> buscarParaPOS(@org.springframework.data.repository.query.Param("q") String q, Pageable pageable);
}

