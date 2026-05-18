package com.maxli.caja.controller;

import com.maxli.caja.dto.CajaRequestDTO;
import com.maxli.caja.dto.CajaResponseDTO;
import com.maxli.caja.service.CajaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cajas")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    @GetMapping
    public ResponseEntity<Page<CajaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(cajaService.listar(pageable));
    }

    @GetMapping("/activas")
    public ResponseEntity<Page<CajaResponseDTO>> listarActivas(Pageable pageable) {
        return ResponseEntity.ok(cajaService.listarActivas(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CajaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(cajaService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<CajaResponseDTO> crear(@Valid @RequestBody CajaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CajaResponseDTO> actualizar(@PathVariable Long id,
                                                       @Valid @RequestBody CajaRequestDTO dto) {
        return ResponseEntity.ok(cajaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        cajaService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
