package com.maxli.venta.controller;

import com.maxli.venta.dto.ReporteVentasDTO;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.service.ReporteService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Reportes de ventas por rango de fecha, sin paginación.
 * <p>
 * Recibe, delega y devuelve: el período, la resta de las notas de crédito y el
 * tope de filas los decide {@link ReporteService}.
 */
@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
public class ReporteController {

    private final ReporteService reporteService;

    @GetMapping("/ventas")
    public ResponseEntity<ReporteVentasDTO> reporteVentas(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) String cajero,
            @RequestParam(required = false) String metodoPago) {

        return ResponseEntity.ok(reporteService.reporteVentas(
                new VentaFiltroDTO(null, desde, hasta, cajero, metodoPago)));
    }
}
