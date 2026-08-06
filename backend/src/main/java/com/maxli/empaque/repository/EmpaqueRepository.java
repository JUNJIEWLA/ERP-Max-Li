package com.maxli.empaque.repository;

import com.maxli.empaque.entity.Empaque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmpaqueRepository extends JpaRepository<Empaque, Long> {

    /** Todos los empaques ordenados por nombre (para el selector del POS). */
    List<Empaque> findByEstadoOrderByCantidadAsc(String estado);

    /** Todos los empaques incluyendo inactivos (para el CRUD). */
    List<Empaque> findAllByOrderByCantidadAsc();

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdEmpaqueNot(String nombre, Long idEmpaque);

    Optional<Empaque> findByNombre(String nombre);
}
