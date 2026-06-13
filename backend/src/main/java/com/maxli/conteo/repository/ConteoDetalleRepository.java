package com.maxli.conteo.repository;

import com.maxli.conteo.entity.ConteoDetalle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConteoDetalleRepository extends JpaRepository<ConteoDetalle, Long> {

    List<ConteoDetalle> findByConteo_IdConteo(Long idConteo);

    Optional<ConteoDetalle> findByConteo_IdConteoAndProducto_IdProducto(Long idConteo, Long idProducto);

    void deleteByConteo_IdConteo(Long idConteo);
}
