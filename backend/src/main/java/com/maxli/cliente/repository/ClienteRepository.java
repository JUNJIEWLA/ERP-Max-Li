package com.maxli.cliente.repository;

import com.maxli.cliente.entity.Cliente;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /** Lista todos los clientes activos ordenados alfabéticamente (para pre-cargar en el POS). */
    List<Cliente> findByEstadoOrderByNombreCompletoAsc(String estado);


    /** Búsqueda adicional por RNC/Cédula para el POS (coincidencia exacta). */
    Optional<Cliente> findByRncCedulaAndEstado(String rncCedula, String estado);

    /** Verifica existencia de RNC/Cédula para validar duplicados al crear. */
    boolean existsByRncCedula(String rncCedula);

    /** Verifica duplicado excluyendo el propio registro al actualizar. */
    boolean existsByRncCedulaAndIdClienteNot(String rncCedula, Long idCliente);

    /**
     * Obtiene el cliente con bloqueo pesimista de escritura.
     * Usar exclusivamente dentro de la transacción de validación de crédito
     * para evitar condiciones de carrera cuando dos ventas al mismo cliente
     * se procesan simultáneamente.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Cliente c WHERE c.idCliente = :id")
    Optional<Cliente> findByIdWithLock(@Param("id") Long id);
}
