package com.maxli.oferta.controller;

import com.maxli.oferta.dto.OfertaRequestDTO;
import com.maxli.oferta.dto.OfertaResponseDTO;
import com.maxli.oferta.service.OfertaService;
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

import java.util.List;

@RestController
@RequestMapping("/api/ofertas")
@RequiredArgsConstructor
public class OfertaController {

    private final OfertaService ofertaService;

    @GetMapping
    public ResponseEntity<Page<OfertaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(ofertaService.listar(pageable));
    }

    @GetMapping("/activas")
    public ResponseEntity<Page<OfertaResponseDTO>> listarActivas(Pageable pageable) {
        return ResponseEntity.ok(ofertaService.listarActivas(pageable));
    }

    @GetMapping("/vigentes")
    public ResponseEntity<Page<OfertaResponseDTO>> listarVigentes(Pageable pageable) {
        return ResponseEntity.ok(ofertaService.listarVigentes(pageable));
    }

    @GetMapping("/tipo/{tipo}")
    public ResponseEntity<Page<OfertaResponseDTO>> listarPorTipo(@PathVariable String tipo, Pageable pageable) {
        return ResponseEntity.ok(ofertaService.listarPorTipo(tipo, pageable));
    }

    @GetMapping("/producto/{idProducto}")
    public ResponseEntity<Page<OfertaResponseDTO>> listarPorProducto(@PathVariable Long idProducto, Pageable pageable) {
        return ResponseEntity.ok(ofertaService.listarPorProducto(idProducto, pageable));
    }

    @GetMapping("/producto/{idProducto}/vigentes")
    public ResponseEntity<List<OfertaResponseDTO>> listarVigentesPorProducto(@PathVariable Long idProducto) {
        return ResponseEntity.ok(ofertaService.listarVigentesPorProducto(idProducto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OfertaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ofertaService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<OfertaResponseDTO> crear(@Valid @RequestBody OfertaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ofertaService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OfertaResponseDTO> actualizar(@PathVariable Long id,
                                                        @Valid @RequestBody OfertaRequestDTO dto) {
        return ResponseEntity.ok(ofertaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        ofertaService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
