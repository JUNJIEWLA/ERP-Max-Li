package com.maxli.conteo.repository;

import com.maxli.conteo.entity.ConteoCabecera;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ConteoCabeceraRepository extends JpaRepository<ConteoCabecera, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ConteoCabecera c WHERE c.idConteo = :id")
    Optional<ConteoCabecera> bloquearPorIdParaAplicar(@Param("id") Long id);

    Page<ConteoCabecera> findByEstado(String estado, Pageable pageable);

    Page<ConteoCabecera> findByUsuarioAsignado_IdUsuario(Long idUsuario, Pageable pageable);

    Page<ConteoCabecera> findByAlmacen_IdAlmacen(Long idAlmacen, Pageable pageable);
}
