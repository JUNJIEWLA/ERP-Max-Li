package com.maxli.existencia.service;

import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Punto único para adquirir existencias que van a cambiar dentro de una
 * transacción. No debe leerse una existencia para modificarla sin pasar antes
 * por este servicio.
 */
@Service
@RequiredArgsConstructor
public class ExistenciaLockService {

    private final ExistenciaRepository existenciaRepository;
    private final EntityManager entityManager;

    public Optional<Existencia> bloquear(Long idProducto, Long idAlmacen) {
        return existenciaRepository.bloquearPorProductoYAlmacenParaActualizar(idProducto, idAlmacen);
    }

    public Optional<Existencia> bloquearPorId(Long idExistencia) {
        return existenciaRepository.bloquearPorIdParaActualizar(idExistencia);
    }

    public Existencia bloquearRequerida(Long idProducto, Long idAlmacen) {
        return bloquear(idProducto, idAlmacen).orElse(null);
    }

    /**
     * Crea la fila de manera segura si falta y siempre la devuelve bloqueada.
     * INSERT ... ON CONFLICT evita que dos transacciones creen duplicados sin
     * convertir la transacción perdedora en rollback-only.
     */
    public Existencia obtenerOCrearBloqueada(Long idProducto, Long idAlmacen) {
        Optional<Existencia> existente = bloquear(idProducto, idAlmacen);
        if (existente.isPresent()) {
            return existente.get();
        }

        insertarSiAusente(idProducto, idAlmacen);
        return bloquear(idProducto, idAlmacen)
                .orElseThrow(() -> new IllegalStateException("No se pudo obtener la existencia recién creada"));
    }

    public boolean crearManualSiAusente(Long idProducto, Long idAlmacen, int cantidadActual, int cantidadMinima) {
        int insertadas = entityManager.createNativeQuery("""
                INSERT INTO existencia (id_producto, id_almacen, cantidad_actual, cantidad_minima,
                                         fecha_creacion, fecha_modificacion)
                VALUES (:idProducto, :idAlmacen, :cantidadActual, :cantidadMinima, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (id_producto, id_almacen) DO NOTHING
                """)
                .setParameter("idProducto", idProducto)
                .setParameter("idAlmacen", idAlmacen)
                .setParameter("cantidadActual", cantidadActual)
                .setParameter("cantidadMinima", cantidadMinima)
                .executeUpdate();
        return insertadas == 1;
    }

    public Map<ClaveExistencia, Existencia> bloquearOCrearEnOrden(Collection<ClaveExistencia> claves) {
        List<ClaveExistencia> ordenadas = claves.stream().distinct()
                .sorted(Comparator.comparing(ClaveExistencia::idAlmacen)
                        .thenComparing(ClaveExistencia::idProducto))
                .toList();
        Map<ClaveExistencia, Existencia> bloqueadas = new LinkedHashMap<>();
        for (ClaveExistencia clave : ordenadas) {
            bloqueadas.put(clave, obtenerOCrearBloqueada(clave.idProducto(), clave.idAlmacen()));
        }
        return bloqueadas;
    }

    public Map<ClaveExistencia, Existencia> bloquearExistentesEnOrden(Collection<ClaveExistencia> claves) {
        List<ClaveExistencia> ordenadas = claves.stream().distinct()
                .sorted(Comparator.comparing(ClaveExistencia::idAlmacen)
                        .thenComparing(ClaveExistencia::idProducto))
                .toList();
        Map<ClaveExistencia, Existencia> bloqueadas = new LinkedHashMap<>();
        for (ClaveExistencia clave : ordenadas) {
            bloquear(clave.idProducto(), clave.idAlmacen()).ifPresent(existencia -> bloqueadas.put(clave, existencia));
        }
        return bloqueadas;
    }

    private void insertarSiAusente(Long idProducto, Long idAlmacen) {
        entityManager.createNativeQuery("""
                INSERT INTO existencia (id_producto, id_almacen, cantidad_actual, cantidad_minima,
                                         fecha_creacion, fecha_modificacion)
                VALUES (:idProducto, :idAlmacen, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (id_producto, id_almacen) DO NOTHING
                """)
                .setParameter("idProducto", idProducto)
                .setParameter("idAlmacen", idAlmacen)
                .executeUpdate();
    }

    public record ClaveExistencia(Long idProducto, Long idAlmacen) { }
}
