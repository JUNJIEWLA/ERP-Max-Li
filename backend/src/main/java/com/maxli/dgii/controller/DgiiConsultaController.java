package com.maxli.dgii.controller;

import com.maxli.dgii.dto.DgiiConsultaResponseDTO;
import com.maxli.dgii.service.DgiiConsultaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dgii")
@RequiredArgsConstructor
public class DgiiConsultaController {

    private final DgiiConsultaService dgiiConsultaService;

    @GetMapping("/consultar/{rnc}")
    public ResponseEntity<DgiiConsultaResponseDTO> consultarRnc(@PathVariable String rnc) {
        return ResponseEntity.ok(dgiiConsultaService.consultarRnc(rnc));
    }
}
