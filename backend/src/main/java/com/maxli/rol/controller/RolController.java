package com.maxli.rol.controller;

import com.maxli.permiso.dto.PermisoResponseDTO;
import com.maxli.permiso.mapper.PermisoMapper;
import com.maxli.permiso.repository.PermisoRepository;
import com.maxli.rol.dto.RolRequestDTO;
import com.maxli.rol.dto.RolResponseDTO;
import com.maxli.rol.service.RolService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RolController {

    private final RolService rolService;
    private final PermisoRepository permisoRepository;
    private final PermisoMapper permisoMapper;

    @GetMapping
    public ResponseEntity<Page<RolResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(rolService.listar(pageable));
    }

    /** Lista todos los roles sin paginación (para selects en UI). */
    @GetMapping("/todos")
    public ResponseEntity<List<RolResponseDTO>> listarTodos() {
        return ResponseEntity.ok(rolService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RolResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(rolService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<RolResponseDTO> crear(@Valid @RequestBody RolRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rolService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RolResponseDTO> actualizar(@PathVariable Long id,
                                                     @Valid @RequestBody RolRequestDTO dto) {
        return ResponseEntity.ok(rolService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        rolService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    /** Lista todos los permisos del sistema, agrupados por módulo. */
    @GetMapping("/permisos")
    public ResponseEntity<List<PermisoResponseDTO>> listarPermisos() {
        List<PermisoResponseDTO> permisos = permisoRepository.findAllByOrderByModuloAscNombreClaveAsc()
                .stream()
                .map(permisoMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(permisos);
    }
}
