package com.maxli.venta.controller;

import com.maxli.venta.dto.CrearVentaRequestDTO;
import com.maxli.venta.dto.RecalcularFacturaRequestDTO;
import com.maxli.venta.dto.RecalcularFacturaResponseDTO;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.dto.VentaResponseDTO;
import com.maxli.venta.dto.VentaResumenDTO;
import com.maxli.venta.service.VentaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/ventas")
@RequiredArgsConstructor
public class VentaController {

    private final VentaService ventaService;

    /**
     * Recalcula la factura al cambiar método de pago o tipo NCF (preview, no persiste).
     * Devuelve los items recalculados con alertas de cambio de precio.
     */
    @PostMapping("/recalcular")
    public ResponseEntity<RecalcularFacturaResponseDTO> recalcular(
            @Valid @RequestBody RecalcularFacturaRequestDTO request) {
        return ResponseEntity.ok(ventaService.recalcularFactura(request));
    }

    /**
     * Procesa una venta completa de forma atómica.
     * Requiere turno abierto del usuario autenticado.
     */
    @PostMapping
    public ResponseEntity<VentaResponseDTO> procesar(
            @Valid @RequestBody CrearVentaRequestDTO request,
            Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ventaService.procesarVenta(request, principal.getName()));
    }

    /** Buscar una venta por su ID. */
    @GetMapping("/{id}")
    public ResponseEntity<VentaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ventaService.buscarPorId(id));
    }

    /**
     * Historial de Ventas: página filtrada en servidor.
     * <p>
     * Todos los filtros son opcionales y se combinan entre sí. Devuelve un
     * resumen por fila; el detalle completo se pide con {@code GET /{id}}.
     */
    @GetMapping
    public ResponseEntity<Page<VentaResumenDTO>> listar(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaHasta,
            @RequestParam(required = false) String cajero,
            @RequestParam(required = false) String metodoPago,
            @RequestParam(required = false) String estado,
            @PageableDefault(size = 20) Pageable pageable) {
        VentaFiltroDTO filtro = new VentaFiltroDTO(q, fechaDesde, fechaHasta, cajero, metodoPago, estado);
        return ResponseEntity.ok(ventaService.listar(filtro, pageable));
    }

    /** Obtener el siguiente número de control para preview en el frontend. */
    @GetMapping("/siguiente-numero")
    public ResponseEntity<Map<String, String>> siguienteNumero() {
        return ResponseEntity.ok(Map.of("numeroControl", ventaService.obtenerSiguienteNumero()));
    }
}
