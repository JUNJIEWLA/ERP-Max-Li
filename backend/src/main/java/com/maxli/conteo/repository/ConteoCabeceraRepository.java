package com.maxli.conteo.repository;

import com.maxli.conteo.entity.ConteoCabecera;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConteoCabeceraRepository extends JpaRepository<ConteoCabecera, Long> {

    Page<ConteoCabecera> findByEstado(String estado, Pageable pageable);

    Page<ConteoCabecera> findByUsuarioAsignado_IdUsuario(Long idUsuario, Pageable pageable);

    Page<ConteoCabecera> findByAlmacen_IdAlmacen(Long idAlmacen, Pageable pageable);
}
