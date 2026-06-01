package com.maxli.compra.repository;

import com.maxli.compra.entity.DetalleNotaRecepcion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DetalleNotaRecepcionRepository extends JpaRepository<DetalleNotaRecepcion, Long> {

    List<DetalleNotaRecepcion> findByNotaRecepcion_IdNotaRecepcion(Long idNotaRecepcion);
}
