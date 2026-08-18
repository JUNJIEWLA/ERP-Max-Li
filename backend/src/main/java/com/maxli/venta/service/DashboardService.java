package com.maxli.venta.service;

import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.producto.repository.ProductoRepository;
import com.maxli.venta.dto.*;
import com.maxli.venta.repository.VentaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Servicio que consolida todas las estadísticas del Dashboard en una sola
 * llamada. Usa queries nativas para máxima eficiencia.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    @PersistenceContext
    private EntityManager em;

    private final ProductoRepository productoRepository;
    private final ExistenciaRepository existenciaRepository;

    @Transactional(readOnly = true)
    public DashboardStatsDTO obtenerStats() {
        LocalDate hoy = LocalDate.now();
        LocalDate ayer = hoy.minusDays(1);
        LocalDateTime inicioHoy = hoy.atStartOfDay();
        LocalDateTime finHoy = hoy.atTime(LocalTime.MAX);
        LocalDateTime inicioAyer = ayer.atStartOfDay();
        LocalDateTime finAyer = ayer.atTime(LocalTime.MAX);
        LocalDateTime inicio7Dias = hoy.minusDays(6).atStartOfDay();

        // ── KPIs ─────────────────────────────────────────────
        BigDecimal ventasHoy = sumVentas(inicioHoy, finHoy);
        BigDecimal ventasAyer = sumVentas(inicioAyer, finAyer);
        long txHoy = countVentas(inicioHoy, finHoy);
        long txAyer = countVentas(inicioAyer, finAyer);
        BigDecimal itbisHoy = sumItbis(inicioHoy, finHoy);
        long productosActivos = productoRepository.count();
        long productosBajoStock = countProductosBajoStock();

        // ── Ventas últimos 7 días ────────────────────────────
        List<VentaDiariaDTO> ventas7Dias = ventasUltimos7Dias(inicio7Dias, finHoy);

        // ── Ventas por método de pago (hoy) ──────────────────
        List<MetodoPagoStatsDTO> porMetodo = ventasPorMetodoPago(inicioHoy, finHoy);

        // ── Top 5 productos hoy ──────────────────────────────
        List<TopProductoDTO> topProductos = topProductosHoy(inicioHoy, finHoy);

        // ── Últimas 10 ventas ────────────────────────────────
        List<UltimaVentaDTO> ultimas = ultimasVentas();

        return new DashboardStatsDTO(
                ventasHoy, ventasAyer, txHoy, txAyer,
                productosActivos, productosBajoStock, itbisHoy,
                ventas7Dias, porMetodo, topProductos, ultimas
        );
    }

    // ── Queries privadas ─────────────────────────────────────

    private BigDecimal sumVentas(LocalDateTime desde, LocalDateTime hasta) {
        Object result = em.createQuery(
                "SELECT COALESCE(SUM(v.total), 0) FROM Venta v " +
                "WHERE v.fechaVenta BETWEEN :desde AND :hasta " +
                "AND v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA')")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .getSingleResult();
        return (BigDecimal) result;
    }

    private long countVentas(LocalDateTime desde, LocalDateTime hasta) {
        Object result = em.createQuery(
                "SELECT COUNT(v) FROM Venta v " +
                "WHERE v.fechaVenta BETWEEN :desde AND :hasta " +
                "AND v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA')")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .getSingleResult();
        return (Long) result;
    }

    private BigDecimal sumItbis(LocalDateTime desde, LocalDateTime hasta) {
        Object result = em.createQuery(
                "SELECT COALESCE(SUM(v.itbis), 0) FROM Venta v " +
                "WHERE v.fechaVenta BETWEEN :desde AND :hasta " +
                "AND v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA')")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .getSingleResult();
        return (BigDecimal) result;
    }

    private long countProductosBajoStock() {
        Object result = em.createQuery(
                "SELECT COUNT(DISTINCT e.producto.idProducto) FROM Existencia e " +
                "WHERE e.cantidadActual < e.cantidadMinima AND e.cantidadMinima > 0")
                .getSingleResult();
        return (Long) result;
    }

    @SuppressWarnings("unchecked")
    private List<VentaDiariaDTO> ventasUltimos7Dias(LocalDateTime desde, LocalDateTime hasta) {
        List<Object[]> rows = em.createQuery(
                "SELECT FUNCTION('DATE', v.fechaVenta), COALESCE(SUM(v.total), 0), COUNT(v) " +
                "FROM Venta v " +
                "WHERE v.fechaVenta BETWEEN :desde AND :hasta " +
                "AND v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA') " +
                "GROUP BY FUNCTION('DATE', v.fechaVenta) " +
                "ORDER BY FUNCTION('DATE', v.fechaVenta)")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .getResultList();

        List<VentaDiariaDTO> result = new ArrayList<>();
        for (Object[] row : rows) {
            String fecha = row[0].toString();
            BigDecimal total = (BigDecimal) row[1];
            long tx = (Long) row[2];
            result.add(new VentaDiariaDTO(fecha, total, tx));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<MetodoPagoStatsDTO> ventasPorMetodoPago(LocalDateTime desde, LocalDateTime hasta) {
        List<Object[]> rows = em.createQuery(
                "SELECT v.metodoPagoPrincipal, COALESCE(SUM(v.total), 0), COUNT(v) " +
                "FROM Venta v " +
                "WHERE v.fechaVenta BETWEEN :desde AND :hasta " +
                "AND v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA') " +
                "GROUP BY v.metodoPagoPrincipal " +
                "ORDER BY SUM(v.total) DESC")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .getResultList();

        List<MetodoPagoStatsDTO> result = new ArrayList<>();
        for (Object[] row : rows) {
            String metodo = row[0].toString();
            BigDecimal total = (BigDecimal) row[1];
            long tx = (Long) row[2];
            result.add(new MetodoPagoStatsDTO(metodo, total, tx));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<TopProductoDTO> topProductosHoy(LocalDateTime desde, LocalDateTime hasta) {
        List<Object[]> rows = em.createQuery(
                "SELECT d.producto.idProducto, d.producto.sku, d.producto.nombre, " +
                "SUM(d.cantidad), SUM(d.importe) " +
                "FROM DetalleVenta d " +
                "WHERE d.venta.fechaVenta BETWEEN :desde AND :hasta " +
                "AND d.venta.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA') " +
                "GROUP BY d.producto.idProducto, d.producto.sku, d.producto.nombre " +
                "ORDER BY SUM(d.cantidad) DESC")
                .setParameter("desde", desde)
                .setParameter("hasta", hasta)
                .setMaxResults(5)
                .getResultList();

        List<TopProductoDTO> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new TopProductoDTO(
                    (Long) row[0],
                    (String) row[1],
                    (String) row[2],
                    ((Number) row[3]).longValue(),
                    (BigDecimal) row[4]
            ));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<UltimaVentaDTO> ultimasVentas() {
        List<Object[]> rows = em.createQuery(
                "SELECT v.idVenta, v.numeroControl, " +
                "COALESCE(v.nombreClienteTemporal, c.nombreCompleto, 'Consumidor Final'), " +
                "u.username, v.metodoPagoPrincipal, v.total, v.fechaVenta " +
                "FROM Venta v " +
                "JOIN v.usuario u " +
                "LEFT JOIN v.cliente c " +
                "WHERE v.estado IN ('COMPLETADA', 'PARCIALMENTE_DEVUELTA') " +
                "ORDER BY v.fechaVenta DESC")
                .setMaxResults(10)
                .getResultList();

        List<UltimaVentaDTO> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new UltimaVentaDTO(
                    (Long) row[0],
                    (String) row[1],
                    (String) row[2],
                    (String) row[3],
                    row[4].toString(),
                    (BigDecimal) row[5],
                    row[6].toString()
            ));
        }
        return result;
    }
}
