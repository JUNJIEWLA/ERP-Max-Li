package com.maxli.empresa.controller;

import com.maxli.empresa.dto.ConfiguracionEmpresaDTO;
import com.maxli.empresa.service.ConfiguracionEmpresaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de configuración corporativa de la empresa.
 *
 * <pre>
 *   GET  /api/empresa/configuracion  → lee la configuración actual (autenticado)
 *   PUT  /api/empresa/configuracion  → actualiza la configuración (CONFIGURACION_VER)
 * </pre>
 *
 * <p>El GET está disponible a cualquier usuario autenticado porque los datos
 * de empresa se usan en varias partes del sistema (encabezados, etc.).
 * El PUT requiere el permiso CONFIGURACION_VER reservado al administrador.
 */
@RestController
@RequestMapping("/api/empresa")
@RequiredArgsConstructor
public class ConfiguracionEmpresaController {

    private final ConfiguracionEmpresaService service;

    /**
     * Devuelve la configuración actual de la empresa.
     * Accesible para cualquier usuario autenticado.
     */
    @GetMapping("/configuracion")
    public ResponseEntity<ConfiguracionEmpresaDTO> obtener() {
        return ResponseEntity.ok(service.obtener());
    }

    /**
     * Actualiza la configuración de la empresa.
     * Requiere permiso CONFIGURACION_VER (administrador / supervisor).
     */
    @PutMapping("/configuracion")
    @PreAuthorize("hasAuthority('CONFIGURACION_VER')")
    public ResponseEntity<ConfiguracionEmpresaDTO> actualizar(
            @Valid @RequestBody ConfiguracionEmpresaDTO dto) {
        return ResponseEntity.ok(service.actualizar(dto));
    }
}
