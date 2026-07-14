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

    // Este endpoint puede ser usado internamente por el sistema (cajeros) al facturar, 
    // pero como prueba podemos exponerlo o mantenerlo restringido. 
    // Asumiremos que es llamado por el módulo de facturación, no directamente por el frontend.
    @PostMapping("/generar/{tipoNcf}")
    public ResponseEntity<NcfGeneradoDTO> generarSiguienteNcf(@PathVariable String tipoNcf) {
        return ResponseEntity.ok(ncfService.generarSiguienteNcf(tipoNcf));
    }
}
