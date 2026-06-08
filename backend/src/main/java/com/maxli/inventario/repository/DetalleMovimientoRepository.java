package com.maxli.inventario.repository;

import com.maxli.inventario.entity.DetalleMovimiento;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetalleMovimientoRepository extends JpaRepository<DetalleMovimiento, Long> {
}
