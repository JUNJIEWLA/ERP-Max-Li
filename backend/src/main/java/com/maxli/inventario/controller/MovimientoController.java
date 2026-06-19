package com.maxli.inventario.controller;

import com.maxli.inventario.dto.MovimientoRequestDTO;
import com.maxli.inventario.dto.MovimientoResponseDTO;
import com.maxli.inventario.service.MovimientoService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/movimientos")
@RequiredArgsConstructor
public class MovimientoController {

    private final MovimientoService movimientoService;

    @GetMapping
    public ResponseEntity<Page<MovimientoResponseDTO>> listar(
            @PageableDefault(sort = "idMovimiento", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(movimientoService.listar(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MovimientoResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(movimientoService.buscarPorId(id));
    }

    @GetMapping("/almacen/{idAlmacen}")
    public ResponseEntity<Page<MovimientoResponseDTO>> listarPorAlmacen(
            @PathVariable Long idAlmacen,
            @PageableDefault(sort = "idMovimiento", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(movimientoService.listarPorAlmacen(idAlmacen, pageable));
    }

    @GetMapping("/tipo/{tipo}")
    public ResponseEntity<Page<MovimientoResponseDTO>> listarPorTipo(
            @PathVariable String tipo,
            @PageableDefault(sort = "idMovimiento", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(movimientoService.listarPorTipo(tipo, pageable));
    }

    @PostMapping("/transferencia")
    public ResponseEntity<MovimientoResponseDTO> crearTransferencia(
            @Valid @RequestBody MovimientoRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(movimientoService.crearTransferencia(dto));
    }
}
