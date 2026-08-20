package com.maxli.devolucion.repository;

import com.maxli.devolucion.dto.TotalesNotasCreditoDTO;
import com.maxli.devolucion.entity.Devolucion;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface DevolucionRepository extends JpaRepository<Devolucion, Long> {

    boolean existsByReferenciaOperacion(String referenciaOperacion);

    /**
     * Página del historial de devoluciones. {@code idVenta} nulo desactiva su
     * filtro. El orden lo fija el servidor —descendente por {@code idDevolucion},
     * que es único— para que ninguna fila se repita o desaparezca al paginar.
     */
    @Query("""
            SELECT d FROM Devolucion d
            WHERE (:idVenta IS NULL OR d.venta.idVenta = :idVenta)
            ORDER BY d.idDevolucion DESC
            """)
    Page<Devolucion> buscar(@Param("idVenta") Long idVenta, Pageable pageable);

    /**
     * Notas de Crédito que revierten las ventas de un reporte.
     * <p>
     * El filtro es el de las ventas, no el de las devoluciones: se acumula lo
     * acreditado sobre <b>las ventas que el reporte lista</b>. Así cada peso
     * restado se puede rastrear hasta una fila visible en la tabla, y un
     * reporte filtrado por cajero o método de pago no resta el crédito de
     * ventas que ni siquiera muestra.
     * <p>
     * Como contrapartida, la nota de crédito se imputa al período de su venta
     * y no al de su propia emisión: devolver en septiembre una venta de agosto
     * corrige el reporte de agosto, que es donde está la venta que dejó de
     * serlo.
     */
    @Query("""
            SELECT new com.maxli.devolucion.dto.TotalesNotasCreditoDTO(
                       COALESCE(SUM(d.total), 0),
                       COALESCE(SUM(d.itbis), 0),
                       COUNT(d))
            FROM Devolucion d
            JOIN d.venta v
            JOIN v.usuario u
            LEFT JOIN v.cliente c
            WHERE d.estado = 'CONFIRMADA'
              AND (:q IS NULL
                   OR LOWER(v.numeroControl) LIKE :q
                   OR LOWER(v.ncf) LIKE :q
                   OR LOWER(c.nombreCompleto) LIKE :q
                   OR LOWER(v.nombreClienteTemporal) LIKE :q)
              AND (CAST(:desde AS timestamp) IS NULL OR v.fechaVenta >= :desde)
              AND (CAST(:hasta AS timestamp) IS NULL OR v.fechaVenta <= :hasta)
              AND (:cajero IS NULL OR LOWER(u.username) = :cajero)
              AND (:metodoPago IS NULL OR v.metodoPagoPrincipal = :metodoPago)
            """)
    TotalesNotasCreditoDTO sumarNotasCreditoDeVentas(
            @Param("q") String q,
            @Param("desde") java.time.LocalDateTime desde,
            @Param("hasta") java.time.LocalDateTime hasta,
            @Param("cajero") String cajero,
            @Param("metodoPago") com.maxli.venta.entity.MetodoPago metodoPago);

    /**
     * Efectivo reembolsado durante el turno. Solo cuenta lo devuelto en
     * efectivo: una devolución por tarjeta o transferencia no saca dinero del
     * cajón, así que no puede bajar el monto esperado del cierre.
     */
    @Query("""
            SELECT COALESCE(SUM(d.total), 0)
            FROM Devolucion d
            WHERE d.turnoCaja.idTurnoCaja = :idTurno
              AND d.metodoReembolso = com.maxli.venta.entity.MetodoPago.EFECTIVO
            """)
    BigDecimal sumarReembolsosEfectivoPorTurno(@Param("idTurno") Long idTurno);

    @Query(value = "SELECT nextval('seq_numero_control_devolucion')", nativeQuery = true)
    Long obtenerSiguienteNumeroControl();

    /** Consulta de solo lectura: informa del saldo, no habilita a gastarlo. */
    @Query(BUSQUEDA_POR_NUMERO)
    java.util.List<Devolucion> buscarPorNumero(@Param("numero") String numero);

    /**
     * Las mismas notas de crédito, con sus filas bloqueadas hasta el final de la
     * transacción que las cobra.
     * <p>
     * Cobrar una Nota de Crédito es leer el saldo, restarle el importe y
     * guardar. Sin este bloqueo son dos cajas leyendo el mismo saldo, las dos
     * dándolo por suficiente y el mismo crédito pagando dos compras: la
     * diferencia la pone la tienda. El bloqueo del turno no alcanza —cada caja
     * tiene el suyo— ni el de la secuencia NCF, que solo serializa a quienes
     * facturan con el mismo tipo de comprobante.
     * <p>
     * El orden de bloqueo es el mismo de la consulta, descendente por
     * {@code idDevolucion}, para que dos cobros que compitan por varias notas
     * las tomen en el mismo orden y no se abracen.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(BUSQUEDA_POR_NUMERO)
    java.util.List<Devolucion> bloquearPorNumero(@Param("numero") String numero);

    /**
     * Una Nota de Crédito se localiza por su propio número, por el del
     * comprobante que la originó o por el de la venta: el cliente llega con el
     * papel que conserve.
     */
    String BUSQUEDA_POR_NUMERO = """
            SELECT d FROM Devolucion d
            WHERE (LOWER(d.numeroControl) = LOWER(:numero)
               OR LOWER(d.ncf) = LOWER(:numero)
               OR LOWER(d.numeroControlVenta) = LOWER(:numero)
               OR LOWER(d.ncfAfectado) = LOWER(:numero)
               OR CAST(d.venta.idVenta AS string) = :numero)
              AND d.estado = 'CONFIRMADA'
            ORDER BY d.idDevolucion DESC
            """;
}
