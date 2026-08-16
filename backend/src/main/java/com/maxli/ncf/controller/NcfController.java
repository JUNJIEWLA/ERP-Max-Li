package com.maxli.ncf.controller;

import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.dto.ResolucionNcfRequestDTO;
import com.maxli.ncf.dto.ResolucionNcfResponseDTO;
import com.maxli.ncf.service.NcfService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ncf")
@RequiredArgsConstructor
public class NcfController {

    private final NcfService ncfService;

    // Solo el ADMIN tiene permiso
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<ResolucionNcfResponseDTO>> obtenerTodasResoluciones() {
        return ResponseEntity.ok(ncfService.obtenerTodasResoluciones());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ResolucionNcfResponseDTO> crearResolucion(@Valid @RequestBody ResolucionNcfRequestDTO requestDTO) {
        return new ResponseEntity<>(ncfService.crearResolucion(requestDTO), HttpStatus.CREATED);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ResolucionNcfResponseDTO> actualizarResolucion(
            @PathVariable Long id,
            @Valid @RequestBody ResolucionNcfRequestDTO requestDTO) {
        return ResponseEntity.ok(ncfService.actualizarResolucion(id, requestDTO));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/activar")
    public ResponseEntity<ResolucionNcfResponseDTO> activarResolucion(@PathVariable Long id) {
        return ResponseEntity.ok(ncfService.activarResolucion(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/desactivar")
    public ResponseEntity<ResolucionNcfResponseDTO> desactivarResolucion(@PathVariable Long id) {
        return ResponseEntity.ok(ncfService.desactivarResolucion(id));
    }

    /** Previsualiza el próximo NCF sin consumirlo. Usado por el POS para mostrar en el header. */
    @GetMapping("/preview/{tipoNcf}")
    public ResponseEntity<NcfGeneradoDTO> previsualizarSiguienteNcf(@PathVariable String tipoNcf) {
        return ResponseEntity.ok(ncfService.previsualizarSiguienteNcf(tipoNcf));
    }
}
