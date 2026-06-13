package com.maxli.producto.controller;

import com.maxli.producto.dto.HistorialCostoResponseDTO;
import com.maxli.producto.service.HistorialCostoService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/productos/{idProducto}/historial-costos")
@RequiredArgsConstructor
public class HistorialCostoController {

    private final HistorialCostoService historialCostoService;

    @GetMapping
    public ResponseEntity<Page<HistorialCostoResponseDTO>> listarPorProducto(
            @PathVariable Long idProducto, Pageable pageable) {
        return ResponseEntity.ok(historialCostoService.listarPorProducto(idProducto, pageable));
    }
}
