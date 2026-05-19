package com.maxli.producto.repository;

import com.maxli.producto.entity.Marca;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarcaRepository extends JpaRepository<Marca, Long> {

    Page<Marca> findByEstado(String estado, Pageable pageable);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdMarcaNot(String nombre, Long idMarca);
}
