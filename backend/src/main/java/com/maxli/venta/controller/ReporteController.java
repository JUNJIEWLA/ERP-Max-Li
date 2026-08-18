package com.maxli.venta.controller;

import com.maxli.venta.dto.ReporteVentasDTO;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.dto.VentaResumenDTO;
import com.maxli.venta.service.VentaService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Genera reportes de ventas por rango de fecha, sin paginación.
 * Devuelve todas las ventas del rango + totales consolidados.
 */
@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
public class ReporteController {

    private final VentaService ventaService;

    @GetMapping("/ventas")
    public ResponseEntity<ReporteVentasDTO> reporteVentas(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) String cajero,
            @RequestParam(required = false) String metodoPago) {

        VentaFiltroDTO filtro = new VentaFiltroDTO(null, desde, hasta, cajero, metodoPago);

        // Traer todas las ventas del rango (max 10,000 para evitar OOM en reportes extremos)
        List<VentaResumenDTO> todas = new ArrayList<>();
        int page = 0;
        int pageSize = 500;
        Page<VentaResumenDTO> resultado;

        do {
            resultado = ventaService.listar(filtro, PageRequest.of(page, pageSize));
            todas.addAll(resultado.getContent());
            page++;
        } while (page < resultado.getTotalPages() && todas.size() < 10_000);

        // Calcular totales
        BigDecimal totalVentas = BigDecimal.ZERO;
        BigDecimal totalItbis = BigDecimal.ZERO;
        BigDecimal totalDescuentos = BigDecimal.ZERO;

        for (VentaResumenDTO v : todas) {
            totalVentas = totalVentas.add(v.total() != null ? v.total() : BigDecimal.ZERO);
        }

        return ResponseEntity.ok(new ReporteVentasDTO(
                todas, totalVentas, totalItbis, totalDescuentos, todas.size()
        ));
    }
}
