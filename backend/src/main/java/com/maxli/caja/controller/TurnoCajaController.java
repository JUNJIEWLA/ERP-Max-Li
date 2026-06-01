package com.maxli.caja.controller;

import com.maxli.caja.dto.AbrirTurnoCajaRequestDTO;
import com.maxli.caja.dto.CerrarTurnoCajaRequestDTO;
import com.maxli.caja.dto.CuadreTurnoCajaResponseDTO;
import com.maxli.caja.dto.TurnoCajaResponseDTO;
import com.maxli.caja.service.TurnoCajaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/cajas/turnos")
@RequiredArgsConstructor
public class TurnoCajaController {

    private final TurnoCajaService turnoCajaService;

    @GetMapping
    public ResponseEntity<Page<TurnoCajaResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(turnoCajaService.listar(pageable));
    }

    @GetMapping("/abiertos")
    public ResponseEntity<Page<TurnoCajaResponseDTO>> listarAbiertos(Pageable pageable) {
        return ResponseEntity.ok(turnoCajaService.listarAbiertos(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TurnoCajaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(turnoCajaService.buscarPorId(id));
    }

    @GetMapping("/caja/{idCaja}/abierto")
    public ResponseEntity<TurnoCajaResponseDTO> buscarAbiertoPorCaja(@PathVariable Long idCaja) {
        return ResponseEntity.ok(turnoCajaService.buscarAbiertoPorCaja(idCaja));
    }

    @GetMapping("/actual/abierto")
    public ResponseEntity<TurnoCajaResponseDTO> buscarAbiertoActual(Principal principal) {
        return ResponseEntity.ok(turnoCajaService.buscarAbiertoPorUsuario(principal.getName()));
    }

    @GetMapping("/{id}/cuadre")
    public ResponseEntity<CuadreTurnoCajaResponseDTO> calcularCuadre(@PathVariable Long id) {
        return ResponseEntity.ok(turnoCajaService.calcularCuadre(id));
    }

    @PostMapping("/abrir")
    public ResponseEntity<TurnoCajaResponseDTO> abrir(@Valid @RequestBody AbrirTurnoCajaRequestDTO dto,
                                                      Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(turnoCajaService.abrir(dto, principal.getName()));
    }

    @PostMapping("/{id}/cerrar")
    public ResponseEntity<TurnoCajaResponseDTO> cerrar(@PathVariable Long id,
                                                       @Valid @RequestBody CerrarTurnoCajaRequestDTO dto,
                                                       Principal principal) {
        return ResponseEntity.ok(turnoCajaService.cerrar(id, dto, principal.getName()));
    }
}
