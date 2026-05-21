package com.maxli.rol.repository;

import com.maxli.rol.entity.Rol;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RolRepository extends JpaRepository<Rol, Long> {

    Optional<Rol> findByNombre(String nombre);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdRolNot(String nombre, Long idRol);
}
