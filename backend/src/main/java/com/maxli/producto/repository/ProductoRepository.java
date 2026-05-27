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
}
