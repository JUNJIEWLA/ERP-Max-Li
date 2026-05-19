package com.maxli.producto.controller;

import com.maxli.producto.dto.MarcaRequestDTO;
import com.maxli.producto.dto.MarcaResponseDTO;
import com.maxli.producto.service.MarcaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/marcas")
@RequiredArgsConstructor
public class MarcaController {

    private final MarcaService marcaService;

    @GetMapping
    public ResponseEntity<Page<MarcaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(marcaService.listar(pageable));
    }

    @GetMapping("/activas")
    public ResponseEntity<Page<MarcaResponseDTO>> listarActivas(Pageable pageable) {
        return ResponseEntity.ok(marcaService.listarActivas(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MarcaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(marcaService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<MarcaResponseDTO> crear(@Valid @RequestBody MarcaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(marcaService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MarcaResponseDTO> actualizar(@PathVariable Long id,
                                                       @Valid @RequestBody MarcaRequestDTO dto) {
        return ResponseEntity.ok(marcaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        marcaService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
