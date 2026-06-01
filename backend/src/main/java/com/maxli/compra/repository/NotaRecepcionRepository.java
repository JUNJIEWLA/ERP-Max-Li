package com.maxli.compra.repository;

import com.maxli.compra.entity.NotaRecepcion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotaRecepcionRepository extends JpaRepository<NotaRecepcion, Long> {

    Page<NotaRecepcion> findByOrdenCompra_IdOrdenCompra(Long idOrdenCompra, Pageable pageable);
}
