package com.maxli.almacen.controller;

import com.maxli.almacen.dto.AlmacenRequestDTO;
import com.maxli.almacen.dto.AlmacenResponseDTO;
import com.maxli.almacen.service.AlmacenService;
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
@RequestMapping("/api/almacenes")
@RequiredArgsConstructor
public class AlmacenController {

    private final AlmacenService almacenService;

    @GetMapping
    public ResponseEntity<Page<AlmacenResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(almacenService.listar(pageable));
    }

    @GetMapping("/activos")
    public ResponseEntity<Page<AlmacenResponseDTO>> listarActivos(Pageable pageable) {
        return ResponseEntity.ok(almacenService.listarActivos(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlmacenResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(almacenService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<AlmacenResponseDTO> crear(@Valid @RequestBody AlmacenRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(almacenService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AlmacenResponseDTO> actualizar(@PathVariable Long id,
                                                         @Valid @RequestBody AlmacenRequestDTO dto) {
        return ResponseEntity.ok(almacenService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        almacenService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
