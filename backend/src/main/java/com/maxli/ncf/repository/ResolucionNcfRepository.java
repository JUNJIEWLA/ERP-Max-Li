package com.maxli.ncf.repository;

import com.maxli.ncf.entity.ResolucionNcf;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResolucionNcfRepository extends JpaRepository<ResolucionNcf, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ResolucionNcf r WHERE r.tipoNcf = :tipoNcf AND r.estado = 'ACTIVO' ORDER BY r.idResolucion")
    List<ResolucionNcf> findActivasByTipoParaActualizacion(@Param("tipoNcf") String tipoNcf);

    List<ResolucionNcf> findByTipoNcf(String tipoNcf);

    boolean existsByTipoNcfAndEstado(String tipoNcf, String estado);
}
