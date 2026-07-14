package com.maxli.cupon.controller;

import com.maxli.cupon.dto.CuponAplicadoDTO;
import com.maxli.cupon.dto.CuponRequestDTO;
import com.maxli.cupon.dto.CuponResponseDTO;
import com.maxli.cupon.service.CuponService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/cupones")
@RequiredArgsConstructor
public class CuponController {

    private final CuponService cuponService;

    // ── Administración (sólo ADMIN) ──────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<Page<CuponResponseDTO>> listar(
            @PageableDefault(size = 20, sort = "idCupon", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(cuponService.listar(pageable));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/vigentes")
    public ResponseEntity<Page<CuponResponseDTO>> listarVigentes(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(cuponService.listarVigentes(pageable));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<CuponResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(cuponService.buscarPorId(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<CuponResponseDTO> crear(@Valid @RequestBody CuponRequestDTO dto) {
        return new ResponseEntity<>(cuponService.crear(dto), HttpStatus.CREATED);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<CuponResponseDTO> actualizar(
            @PathVariable Long id, @Valid @RequestBody CuponRequestDTO dto) {
        return ResponseEntity.ok(cuponService.actualizar(id, dto));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        cuponService.desactivar(id);
        return ResponseEntity.noContent().build();
    }

    // ── Endpoint para el POS (llamado internamente al facturar) ─────────

    @PostMapping("/aplicar")
    public ResponseEntity<CuponAplicadoDTO> aplicar(
            @RequestParam String codigoSecreto,
            @RequestParam(required = false, defaultValue = "") List<Long> idsCategorias,
            @RequestParam BigDecimal subtotal) {
        return ResponseEntity.ok(cuponService.validarYAplicarCupon(codigoSecreto, idsCategorias, subtotal));
    }
}
