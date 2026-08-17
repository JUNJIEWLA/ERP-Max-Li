package com.maxli.empresa.repository;

import com.maxli.empresa.entity.ConfiguracionEmpresa;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio para la configuración de empresa (singleton id=1).
 *
 * <p>No se declaran métodos adicionales: {@code findById(1L)} y {@code save}
 * cubren todos los casos de uso del módulo.
 */
public interface ConfiguracionEmpresaRepository extends JpaRepository<ConfiguracionEmpresa, Long> {
}
