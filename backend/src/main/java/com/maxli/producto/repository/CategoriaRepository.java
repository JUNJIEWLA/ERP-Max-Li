package com.maxli.producto.repository;

import com.maxli.producto.entity.Categoria;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {

    Page<Categoria> findByEstado(String estado, Pageable pageable);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdCategoriaNot(String nombre, Long idCategoria);
}
