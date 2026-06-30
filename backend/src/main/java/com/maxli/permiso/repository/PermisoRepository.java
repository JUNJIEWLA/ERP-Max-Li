package com.maxli.permiso.repository;

import com.maxli.permiso.entity.Permiso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Set;

public interface PermisoRepository extends JpaRepository<Permiso, Long> {

    List<Permiso> findAllByOrderByModuloAscNombreClaveAsc();

    List<Permiso> findByModulo(String modulo);

    Set<Permiso> findByIdPermisoIn(Set<Long> ids);
}
