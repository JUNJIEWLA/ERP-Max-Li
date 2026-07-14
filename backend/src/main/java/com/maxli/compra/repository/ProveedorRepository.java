package com.maxli.compra.repository;

import com.maxli.compra.entity.Proveedor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface ProveedorRepository extends JpaRepository<Proveedor, Long> {

    Page<Proveedor> findByEstado(String estado, Pageable pageable);

    boolean existsByRnc(String rnc);

    boolean existsByRncAndIdProveedorNot(String rnc, Long idProveedor);

    /** Suma de todos los totales de órdenes no anuladas del proveedor */
    @Query("SELECT COALESCE(SUM(oc.total), 0) FROM OrdenCompra oc " +
           "WHERE oc.proveedor.idProveedor = :idProveedor AND oc.estado != 'ANULADA'")
    BigDecimal sumTotalOrdenesActivas(@Param("idProveedor") Long idProveedor);

    /** Suma de gastos de proveedor marcados como realizados. */
    @Query("SELECT COALESCE(SUM(g.monto), 0) FROM Gasto g " +
           "WHERE g.ordenCompra.proveedor.idProveedor = :idProveedor " +
           "AND g.estado = 'REALIZADO'")
    BigDecimal sumGastosRealizados(@Param("idProveedor") Long idProveedor);
}
