package com.maxli.caja.controller;

import com.maxli.caja.dto.MovimientoCajaRequestDTO;
import com.maxli.caja.dto.MovimientoCajaResponseDTO;
import com.maxli.caja.service.MovimientoCajaService;
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
@RequestMapping("/api/cajas/chicas")
@RequiredArgsConstructor
public class MovimientoCajaController {

    private final MovimientoCajaService movimientoCajaService;

    @GetMapping("/{idCajaChica}/movimientos")
    public ResponseEntity<Page<MovimientoCajaResponseDTO>> listarPorCajaChica(@PathVariable Long idCajaChica,
                                                                              Pageable pageable) {
        return ResponseEntity.ok(movimientoCajaService.listarPorCajaChica(idCajaChica, pageable));
    }

    @GetMapping("/movimientos/{idMovimiento}")
    public ResponseEntity<MovimientoCajaResponseDTO> buscarPorId(@PathVariable Long idMovimiento) {
        return ResponseEntity.ok(movimientoCajaService.buscarPorId(idMovimiento));
    }

    @PostMapping("/{idCajaChica}/movimientos")
    public ResponseEntity<MovimientoCajaResponseDTO> registrar(@PathVariable Long idCajaChica,
                                                               @Valid @RequestBody MovimientoCajaRequestDTO dto,
                                                               Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(movimientoCajaService.registrar(idCajaChica, dto, principal.getName()));
    }
}
