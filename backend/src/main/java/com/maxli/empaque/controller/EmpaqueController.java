package com.maxli.empaque.controller;

import com.maxli.empaque.dto.EmpaqueRequestDTO;
import com.maxli.empaque.dto.EmpaqueResponseDTO;
import com.maxli.empaque.service.EmpaqueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/empaques")
@RequiredArgsConstructor
public class EmpaqueController {

    private final EmpaqueService empaqueService;

    /** Lista todos los empaques (activos e inactivos) — para la pantalla CRUD. */
    @GetMapping
    public ResponseEntity<List<EmpaqueResponseDTO>> listarTodos() {
        return ResponseEntity.ok(empaqueService.listarTodos());
    }

    /** Lista solo los empaques activos ordenados por cantidad — para el selector del POS. */
    @GetMapping("/activos")
    public ResponseEntity<List<EmpaqueResponseDTO>> listarActivos() {
        return ResponseEntity.ok(empaqueService.listarActivos());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @PostMapping
    public ResponseEntity<EmpaqueResponseDTO> crear(@Valid @RequestBody EmpaqueRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(empaqueService.crear(dto));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @PutMapping("/{id}")
    public ResponseEntity<EmpaqueResponseDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody EmpaqueRequestDTO dto) {
        return ResponseEntity.ok(empaqueService.actualizar(id, dto));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        empaqueService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
