package com.maxli.existencia.controller;

import com.maxli.existencia.dto.ExistenciaRequestDTO;
import com.maxli.existencia.dto.ExistenciaResponseDTO;
import com.maxli.existencia.service.ExistenciaService;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/existencias")
@RequiredArgsConstructor
public class ExistenciaController {

    private final ExistenciaService existenciaService;

    @GetMapping
    public ResponseEntity<Page<ExistenciaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(existenciaService.listar(pageable));
    }

    @GetMapping("/bajo-stock")
    public ResponseEntity<Page<ExistenciaResponseDTO>> listarBajoStock(Pageable pageable) {
        return ResponseEntity.ok(existenciaService.listarBajoStock(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExistenciaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(existenciaService.buscarPorId(id));
    }

    @GetMapping("/producto/{idProducto}")
    public ResponseEntity<List<ExistenciaResponseDTO>> buscarPorProducto(@PathVariable Long idProducto) {
        return ResponseEntity.ok(existenciaService.buscarPorProducto(idProducto));
    }

    @GetMapping("/almacen/{idAlmacen}")
    public ResponseEntity<Page<ExistenciaResponseDTO>> listarPorAlmacen(
            @PathVariable Long idAlmacen, Pageable pageable) {
        return ResponseEntity.ok(existenciaService.listarPorAlmacen(idAlmacen, pageable));
    }

    @GetMapping("/almacen/{idAlmacen}/bajo-stock")
    public ResponseEntity<Page<ExistenciaResponseDTO>> listarBajoStockPorAlmacen(
            @PathVariable Long idAlmacen, Pageable pageable) {
        return ResponseEntity.ok(existenciaService.listarBajoStockPorAlmacen(idAlmacen, pageable));
    }

    @PostMapping
    public ResponseEntity<ExistenciaResponseDTO> crear(@Valid @RequestBody ExistenciaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(existenciaService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExistenciaResponseDTO> actualizar(@PathVariable Long id,
                                                            @Valid @RequestBody ExistenciaRequestDTO dto) {
        return ResponseEntity.ok(existenciaService.actualizar(id, dto));
    }
}
