package com.maxli.caja.controller;

import com.maxli.caja.dto.CajaChicaRequestDTO;
import com.maxli.caja.dto.CajaChicaResponseDTO;
import com.maxli.caja.service.CajaChicaService;
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
@RequestMapping("/api/cajas/chicas")
@RequiredArgsConstructor
public class CajaChicaController {

    private final CajaChicaService cajaChicaService;

    @GetMapping
    public ResponseEntity<Page<CajaChicaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(cajaChicaService.listar(pageable));
    }

    @GetMapping("/activas")
    public ResponseEntity<Page<CajaChicaResponseDTO>> listarActivas(Pageable pageable) {
        return ResponseEntity.ok(cajaChicaService.listarActivas(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CajaChicaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(cajaChicaService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<CajaChicaResponseDTO> crear(@Valid @RequestBody CajaChicaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaChicaService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CajaChicaResponseDTO> actualizar(@PathVariable Long id,
                                                           @Valid @RequestBody CajaChicaRequestDTO dto) {
        return ResponseEntity.ok(cajaChicaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        cajaChicaService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
