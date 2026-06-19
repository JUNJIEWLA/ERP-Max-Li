package com.maxli.conteo.controller;

import com.maxli.conteo.dto.ConteoCabeceraResponseDTO;
import com.maxli.conteo.dto.ConteoCreateRequestDTO;
import com.maxli.conteo.dto.ConteoDetallesBatchRequestDTO;
import com.maxli.conteo.dto.ConteoResumenResponseDTO;
import com.maxli.conteo.service.ConteoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
@RequestMapping("/api/conteos")
@RequiredArgsConstructor
public class ConteoController {

    private final ConteoService conteoService;

    @GetMapping
    public ResponseEntity<Page<ConteoResumenResponseDTO>> listar(
            @PageableDefault(sort = "idConteo", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(conteoService.listar(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConteoCabeceraResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(conteoService.buscarPorId(id));
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<Page<ConteoResumenResponseDTO>> listarPorEstado(
            @PathVariable String estado,
            @PageableDefault(sort = "idConteo", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(conteoService.listarPorEstado(estado, pageable));
    }

    @GetMapping("/usuario/{idUsuario}")
    public ResponseEntity<Page<ConteoResumenResponseDTO>> listarPorUsuario(
            @PathVariable Long idUsuario,
            @PageableDefault(sort = "idConteo", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(conteoService.listarPorUsuario(idUsuario, pageable));
    }

    @PostMapping
    public ResponseEntity<ConteoCabeceraResponseDTO> crear(
            @Valid @RequestBody ConteoCreateRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(conteoService.crear(dto));
    }

    @PostMapping("/{id}/lineas")
    public ResponseEntity<ConteoCabeceraResponseDTO> registrarLineas(
            @PathVariable Long id,
            @Valid @RequestBody ConteoDetallesBatchRequestDTO dto) {
        return ResponseEntity.ok(conteoService.registrarLineas(id, dto));
    }

    @PutMapping("/{id}/revision")
    public ResponseEntity<ConteoCabeceraResponseDTO> enviarARevision(@PathVariable Long id) {
        return ResponseEntity.ok(conteoService.enviarARevision(id));
    }

    @PutMapping("/{id}/aplicar")
    public ResponseEntity<ConteoCabeceraResponseDTO> aplicar(@PathVariable Long id) {
        return ResponseEntity.ok(conteoService.aplicar(id));
    }

    @PutMapping("/{id}/anular")
    public ResponseEntity<ConteoCabeceraResponseDTO> anular(@PathVariable Long id) {
        return ResponseEntity.ok(conteoService.anular(id));
    }
}
