package com.maxli.usuario.controller;

import com.maxli.usuario.dto.UsuarioRequestDTO;
import com.maxli.usuario.dto.UsuarioResponseDTO;
import com.maxli.usuario.service.UsuarioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
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

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    @GetMapping
    public ResponseEntity<Page<UsuarioResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(usuarioService.listar(pageable));
    }

    @GetMapping("/activos")
    public ResponseEntity<Page<UsuarioResponseDTO>> listarActivos(Pageable pageable) {
        return ResponseEntity.ok(usuarioService.listarActivos(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<UsuarioResponseDTO> crear(@Valid @RequestBody UsuarioRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usuarioService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioResponseDTO> actualizar(@PathVariable Long id,
                                                         @Valid @RequestBody UsuarioRequestDTO dto) {
        return ResponseEntity.ok(usuarioService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        usuarioService.desactivar(id);
        return ResponseEntity.noContent().build();
    }

    /** Reseteo de contraseña por el administrador. */
    @PutMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetearPassword(@PathVariable Long id,
                                                  @Valid @RequestBody ResetPasswordDTO body) {
        usuarioService.resetearPassword(id, body.getPassword());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/roles/{idRol}")
    public ResponseEntity<UsuarioResponseDTO> asignarRol(@PathVariable Long id,
                                                          @PathVariable Long idRol) {
        return ResponseEntity.ok(usuarioService.asignarRol(id, idRol));
    }

    @DeleteMapping("/{id}/roles/{idRol}")
    public ResponseEntity<UsuarioResponseDTO> quitarRol(@PathVariable Long id,
                                                         @PathVariable Long idRol) {
        return ResponseEntity.ok(usuarioService.quitarRol(id, idRol));
    }

    /** DTO interno para el reset de contraseña. */
    @Getter
    @Setter
    static class ResetPasswordDTO {
        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
        private String password;
    }
}
