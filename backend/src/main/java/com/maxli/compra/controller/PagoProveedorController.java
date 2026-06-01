package com.maxli.compra.controller;

import com.maxli.compra.dto.PagoProveedorRequestDTO;
import com.maxli.compra.dto.PagoProveedorResponseDTO;
import com.maxli.compra.service.PagoProveedorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ordenes-compra/{idOrdenCompra}/pagos")
@RequiredArgsConstructor
public class PagoProveedorController {

    private final PagoProveedorService pagoProveedorService;

    @GetMapping
    public ResponseEntity<List<PagoProveedorResponseDTO>> listarPorOrden(
            @PathVariable Long idOrdenCompra) {
        return ResponseEntity.ok(pagoProveedorService.listarPorOrden(idOrdenCompra));
    }

    @PostMapping
    public ResponseEntity<PagoProveedorResponseDTO> registrarPago(
            @PathVariable Long idOrdenCompra,
            @Valid @RequestBody PagoProveedorRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(pagoProveedorService.registrarPago(idOrdenCompra, dto));
    }
}
