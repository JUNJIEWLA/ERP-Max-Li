package com.maxli.compra.repository;

import com.maxli.compra.entity.DetalleOrdenCompra;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DetalleOrdenCompraRepository extends JpaRepository<DetalleOrdenCompra, Long> {

    List<DetalleOrdenCompra> findByOrdenCompra_IdOrdenCompra(Long idOrdenCompra);
}
