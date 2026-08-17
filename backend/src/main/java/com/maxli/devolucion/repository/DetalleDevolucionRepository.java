package com.maxli.devolucion.repository;

import com.maxli.devolucion.entity.DetalleDevolucion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DetalleDevolucionRepository extends JpaRepository<DetalleDevolucion, Long> {

    /**
     * Todo lo ya acreditado sobre esas líneas de venta. Se traen las filas
     * completas —y no un {@code SUM} por columna— porque el prorrateo necesita
     * acumular cantidad, base, ITBIS y descuento a la vez, y son pocas por línea.
     */
    List<DetalleDevolucion> findByDetalleVenta_IdDetalleVentaIn(Collection<Long> idsDetalleVenta);
}
