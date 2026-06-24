package com.maxli.compra.controller;

import com.maxli.compra.dto.AlertaRetrasoOcResponseDTO;
import com.maxli.compra.service.AlertaRetrasoOcService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alertas-retraso-oc")
@RequiredArgsConstructor
public class AlertaRetrasoOcController {

    private final AlertaRetrasoOcService alertaService;

    /**
     * Lista paginada de alertas PENDIENTES.
     * Ordenadas por días de retraso descendente (más urgentes primero).
     */
    @GetMapping
    public ResponseEntity<Page<AlertaRetrasoOcResponseDTO>> listarPendientes(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(alertaService.listarPendientes(pageable));
    }

    /**
     * Retorna el conteo de alertas de retraso pendientes.
     * Usado por el Header para el badge de la campana.
     */
    @GetMapping("/pendientes/count")
    public ResponseEntity<Map<String, Long>> contarPendientes() {
        return ResponseEntity.ok(Map.of("count", alertaService.contarPendientes()));
    }

    /**
     * Marca una lista de alertas como LEIDA.
     * Body: { "ids": [1, 2, 3] }
     * Respuesta: 204 No Content.
     */
    @PutMapping("/marcar-leidas")
    public ResponseEntity<Void> marcarLeidasMasivo(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.get("ids");
        alertaService.marcarLeidasMasivo(ids);
        return ResponseEntity.noContent().build();
    }
}
