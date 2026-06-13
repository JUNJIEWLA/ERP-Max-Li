package com.maxli.producto.controller;

import com.maxli.producto.dto.AlertaCostoAccionMasivaDTO;
import com.maxli.producto.dto.AlertaCostoResponseDTO;
import com.maxli.producto.service.AlertaCostoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alertas-costo")
@RequiredArgsConstructor
public class AlertaCostoController {

    private final AlertaCostoService alertaCostoService;

    @GetMapping
    public ResponseEntity<Page<AlertaCostoResponseDTO>> listarPendientes(Pageable pageable) {
        return ResponseEntity.ok(alertaCostoService.listarPendientes(pageable));
    }

    @GetMapping("/pendientes/count")
    public ResponseEntity<Map<String, Long>> contarPendientes() {
        return ResponseEntity.ok(Map.of("count", alertaCostoService.contarPendientes()));
    }

    @PutMapping("/aplicar-masivo")
    public ResponseEntity<List<AlertaCostoResponseDTO>> aplicarMasivo(
            @Valid @RequestBody AlertaCostoAccionMasivaDTO dto) {
        return ResponseEntity.ok(alertaCostoService.aplicarMasivo(dto.getIds()));
    }

    @PutMapping("/descartar-masivo")
    public ResponseEntity<List<AlertaCostoResponseDTO>> descartarMasivo(
            @Valid @RequestBody AlertaCostoAccionMasivaDTO dto) {
        return ResponseEntity.ok(alertaCostoService.descartarMasivo(dto.getIds()));
    }
}
