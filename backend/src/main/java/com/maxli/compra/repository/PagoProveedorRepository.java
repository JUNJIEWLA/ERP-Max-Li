package com.maxli.compra.repository;

import com.maxli.compra.entity.PagoProveedor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PagoProveedorRepository extends JpaRepository<PagoProveedor, Long> {

    List<PagoProveedor> findByOrdenCompra_IdOrdenCompra(Long idOrdenCompra);

    @Query("SELECT COALESCE(SUM(p.montoPagado), 0) FROM PagoProveedor p " +
           "WHERE p.ordenCompra.idOrdenCompra = :idOrdenCompra")
    BigDecimal sumMontoPagadoPorOrden(@Param("idOrdenCompra") Long idOrdenCompra);
}
