package com.maxli.cliente.repository;

import com.maxli.cliente.entity.Cliente;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {

    /** Listado paginado filtrado por estado. */
    Page<Cliente> findByEstado(String estado, Pageable pageable);

    /**
     * Búsqueda para el selector del POS: filtra por nombre (contiene, sin distinción
     * de mayúsculas) y por estado ACTIVO. Devuelve lista simple (no paginada)
     * porque el POS necesita resultados inmediatos con un máximo razonable.
     */
    List<Cliente> findTop20ByNombreCompletoContainingIgnoreCaseAndEstadoOrderByNombreCompletoAsc(
            String nombreCompleto, String estado);

    /** Búsqueda adicional por RNC/Cédula para el POS (coincidencia exacta). */
    Optional<Cliente> findByRncCedulaAndEstado(String rncCedula, String estado);

    /** Verifica existencia de RNC/Cédula para validar duplicados al crear. */
    boolean existsByRncCedula(String rncCedula);

    /** Verifica duplicado excluyendo el propio registro al actualizar. */
    boolean existsByRncCedulaAndIdClienteNot(String rncCedula, Long idCliente);
}
