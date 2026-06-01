package com.maxli.compra.repository;

import com.maxli.compra.entity.OrdenCompra;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrdenCompraRepository extends JpaRepository<OrdenCompra, Long> {

    Page<OrdenCompra> findByProveedor_IdProveedor(Long idProveedor, Pageable pageable);

    Page<OrdenCompra> findByEstado(String estado, Pageable pageable);
}
