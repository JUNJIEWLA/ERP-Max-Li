package com.maxli.existencia.repository;

import com.maxli.existencia.entity.Existencia;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExistenciaRepository extends JpaRepository<Existencia, Long> {

    List<Existencia> findByProducto_IdProducto(Long idProducto);

    Optional<Existencia> findFirstByProducto_IdProducto(Long idProducto);

    Optional<Existencia> findByProducto_IdProductoAndAlmacen_IdAlmacen(Long idProducto, Long idAlmacen);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Existencia e WHERE e.idExistencia = :idExistencia")
    Optional<Existencia> bloquearPorIdParaActualizar(@Param("idExistencia") Long idExistencia);

    /**
     * Carga la existencia exacta de (producto, almacén) tomando bloqueo
     * pesimista de fila (en PostgreSQL, {@code SELECT ... FOR NO KEY UPDATE}:
     * excluye a otros escritores de la misma fila). Necesario para que la
     * secuencia validar-stock → decrementar sea atómica frente a otras
     * transacciones: sin él, dos ventas concurrentes leen la misma cantidad
     * obsoleta y ambas confirman (ISSUE-004, sobreventa).
     * <p>
     * Filtra por almacén para no descontar existencia arbitraria cuando el
     * mismo producto está en varios almacenes (ISSUE-007): el
     * {@code UNIQUE(id_producto, id_almacen)} garantiza como máximo una fila,
     * así que no hace falta {@code ORDER BY} para que el resultado sea
     * determinista.
     * <p>
     * Debe invocarse <b>antes</b> de cualquier lectura sin bloqueo de la misma
     * fila dentro de la transacción, para que el contexto de persistencia la
     * cargue ya bloqueada.
     * <p>
     * Las demás rutas que mueven stock (recepción, transferencia, ajuste por
     * conteo) todavía leen sin bloqueo y deberían adoptar esta misma disciplina.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Existencia e WHERE e.producto.idProducto = :idProducto AND e.almacen.idAlmacen = :idAlmacen")
    Optional<Existencia> bloquearPorProductoYAlmacenParaActualizar(
            @Param("idProducto") Long idProducto, @Param("idAlmacen") Long idAlmacen);

    @Query("SELECT e FROM Existencia e WHERE e.cantidadActual < e.cantidadMinima")
    Page<Existencia> findBajoStock(Pageable pageable);

    boolean existsByProducto_IdProducto(Long idProducto);

    boolean existsByProducto_IdProductoAndAlmacen_IdAlmacen(Long idProducto, Long idAlmacen);

    Page<Existencia> findByAlmacen_IdAlmacen(Long idAlmacen, Pageable pageable);

    @Query("SELECT e FROM Existencia e WHERE e.almacen.idAlmacen = :idAlmacen AND e.cantidadActual < e.cantidadMinima")
    Page<Existencia> findBajoStockByAlmacen(@Param("idAlmacen") Long idAlmacen, Pageable pageable);
}
