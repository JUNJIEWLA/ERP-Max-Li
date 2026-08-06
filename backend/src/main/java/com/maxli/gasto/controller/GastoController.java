package com.maxli.gasto.controller;

import com.maxli.gasto.dto.GastoRequestDTO;
import com.maxli.gasto.dto.GastoResponseDTO;
import com.maxli.gasto.dto.OrdenCompraDisponibleDTO;
import com.maxli.gasto.service.GastoService;
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

import java.util.List;

@RestController
@RequestMapping("/api/gastos")
@RequiredArgsConstructor
public class GastoController {

    private final GastoService gastoService;

    @GetMapping
    public ResponseEntity<Page<GastoResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(gastoService.listar(pageable));
    }

    @GetMapping("/ordenes-disponibles")
    public ResponseEntity<List<OrdenCompraDisponibleDTO>> listarOrdenesDisponibles() {
        return ResponseEntity.ok(gastoService.listarOrdenesDisponibles());
    }

    @PostMapping
    public ResponseEntity<GastoResponseDTO> crear(@Valid @RequestBody GastoRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gastoService.crear(dto));
    }

    @PutMapping("/{idGasto}/marcar-realizado")
    public ResponseEntity<GastoResponseDTO> marcarComoRealizado(@PathVariable Long idGasto) {
        return ResponseEntity.ok(gastoService.marcarComoRealizado(idGasto));
    }
}
