package com.maxli.compra.controller;

import com.maxli.compra.dto.OrdenCompraRequestDTO;
import com.maxli.compra.dto.OrdenCompraResponseDTO;
import com.maxli.compra.service.OrdenCompraService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ordenes-compra")
@RequiredArgsConstructor
public class OrdenCompraController {

    private final OrdenCompraService ordenCompraService;

    @GetMapping
    public ResponseEntity<Page<OrdenCompraResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(ordenCompraService.listar(pageable));
    }

    @GetMapping("/proveedor/{idProveedor}")
    public ResponseEntity<Page<OrdenCompraResponseDTO>> listarPorProveedor(
            @PathVariable Long idProveedor, Pageable pageable) {
        return ResponseEntity.ok(ordenCompraService.listarPorProveedor(idProveedor, pageable));
    }

    @GetMapping("/estado")
    public ResponseEntity<Page<OrdenCompraResponseDTO>> listarPorEstado(
            @RequestParam String estado, Pageable pageable) {
        return ResponseEntity.ok(ordenCompraService.listarPorEstado(estado, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrdenCompraResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ordenCompraService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<OrdenCompraResponseDTO> crear(@Valid @RequestBody OrdenCompraRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ordenCompraService.crear(dto));
    }

    @PutMapping("/{id}/enviar")
    public ResponseEntity<OrdenCompraResponseDTO> enviar(@PathVariable Long id) {
        return ResponseEntity.ok(ordenCompraService.enviar(id));
    }

    @PutMapping("/{id}/anular")
    public ResponseEntity<OrdenCompraResponseDTO> anular(@PathVariable Long id) {
        return ResponseEntity.ok(ordenCompraService.anular(id));
    }

    @PutMapping("/{id}/forzar-cierre")
    public ResponseEntity<OrdenCompraResponseDTO> forzarCierre(@PathVariable Long id) {
        return ResponseEntity.ok(ordenCompraService.forzarCierre(id));
    }
}
