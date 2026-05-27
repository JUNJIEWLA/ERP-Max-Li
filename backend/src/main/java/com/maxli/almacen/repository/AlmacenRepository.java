package com.maxli.almacen.repository;

import com.maxli.almacen.entity.Almacen;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AlmacenRepository extends JpaRepository<Almacen, Long> {

    Optional<Almacen> findByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCase(String nombre);

    Page<Almacen> findByEstado(String estado, Pageable pageable);
}
