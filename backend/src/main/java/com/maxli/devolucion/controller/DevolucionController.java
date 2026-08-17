package com.maxli.devolucion.controller;

import com.maxli.devolucion.dto.CrearDevolucionRequestDTO;
import com.maxli.devolucion.dto.DevolucionResponseDTO;
import com.maxli.devolucion.dto.DevolucionResumenDTO;
import com.maxli.devolucion.dto.VentaDevolubleResponseDTO;
import com.maxli.devolucion.service.DevolucionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

/**
 * Devoluciones de venta y sus Notas de Crédito B04.
 * <p>
 * La autorización la fija {@code SecurityConfig}: leer exige {@code VENTA_VER},
 * crear exige {@code DEVOLUCION_CREAR}.
 */
@RestController
@RequestMapping("/api/devoluciones")
@RequiredArgsConstructor
public class DevolucionController {

    private final DevolucionService devolucionService;

    /** Confirma una devolución completa o parcial en una sola transacción. */
    @PostMapping
    public ResponseEntity<DevolucionResponseDTO> crear(
            @Valid @RequestBody CrearDevolucionRequestDTO request,
            Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(devolucionService.crear(request, principal.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DevolucionResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(devolucionService.buscarPorId(id));
    }

    /** Historial paginado, orden descendente por ID y filtro opcional por venta. */
    @GetMapping
    public ResponseEntity<Page<DevolucionResumenDTO>> listar(
            @RequestParam(required = false) Long idVenta,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(devolucionService.listar(idVenta, pageable));
    }

    /** Líneas de la venta con cantidad vendida, ya devuelta y disponible. */
    @GetMapping("/ventas/{idVenta}/disponible")
    public ResponseEntity<VentaDevolubleResponseDTO> consultarDisponible(@PathVariable Long idVenta) {
        return ResponseEntity.ok(devolucionService.consultarDisponible(idVenta));
    }

    /** Consulta el saldo disponible de una Nota de Crédito por número de factura, NCF o número de control. */
    @GetMapping("/nota-credito/saldo")
    public ResponseEntity<com.maxli.devolucion.dto.NotaCreditoSaldoDTO> obtenerSaldoNotaCredito(@RequestParam String numero) {
        return ResponseEntity.ok(devolucionService.obtenerSaldoNotaCredito(numero));
    }
}
