package com.maxli.compra.repository;

import com.maxli.compra.entity.NotaRecepcion;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface NotaRecepcionRepository extends JpaRepository<NotaRecepcion, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT n FROM NotaRecepcion n WHERE n.idNotaRecepcion = :id")
    Optional<NotaRecepcion> bloquearPorIdParaConfirmar(@Param("id") Long id);

    Page<NotaRecepcion> findByOrdenCompra_IdOrdenCompra(Long idOrdenCompra, Pageable pageable);
}
