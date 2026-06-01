package com.maxli.compra.controller;

import com.maxli.compra.dto.NotaRecepcionRequestDTO;
import com.maxli.compra.dto.NotaRecepcionResponseDTO;
import com.maxli.compra.service.NotaRecepcionService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notas-recepcion")
@RequiredArgsConstructor
public class NotaRecepcionController {

    private final NotaRecepcionService notaRecepcionService;

    @GetMapping
    public ResponseEntity<Page<NotaRecepcionResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(notaRecepcionService.listar(pageable));
    }

    @GetMapping("/orden/{idOrdenCompra}")
    public ResponseEntity<Page<NotaRecepcionResponseDTO>> listarPorOrden(
            @PathVariable Long idOrdenCompra, Pageable pageable) {
        return ResponseEntity.ok(notaRecepcionService.listarPorOrden(idOrdenCompra, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotaRecepcionResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(notaRecepcionService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<NotaRecepcionResponseDTO> crear(@Valid @RequestBody NotaRecepcionRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notaRecepcionService.crear(dto));
    }

    @PutMapping("/{id}/confirmar")
    public ResponseEntity<NotaRecepcionResponseDTO> confirmar(@PathVariable Long id) {
        return ResponseEntity.ok(notaRecepcionService.confirmar(id));
    }

    @PutMapping("/{id}/rechazar")
    public ResponseEntity<NotaRecepcionResponseDTO> rechazar(@PathVariable Long id) {
        return ResponseEntity.ok(notaRecepcionService.rechazar(id));
    }
}
