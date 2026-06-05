package com.maxli.cliente.controller;

import com.maxli.cliente.dto.ClienteRequestDTO;
import com.maxli.cliente.dto.ClienteResumenDTO;
import com.maxli.cliente.dto.ClienteResponseDTO;
import com.maxli.cliente.service.ClienteService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;

    /** Listado paginado completo (página de gestión). */
    @GetMapping
    public ResponseEntity<Page<ClienteResponseDTO>> listar(Pageable pageable) {
        return ResponseEntity.ok(clienteService.listar(pageable));
    }

    /** Listado paginado solo activos. */
    @GetMapping("/activos")
    public ResponseEntity<Page<ClienteResponseDTO>> listarActivos(Pageable pageable) {
        return ResponseEntity.ok(clienteService.listarActivos(pageable));
    }

    /** Búsqueda rápida para el selector del POS — retorna máx. 20 resultados. */
    @GetMapping("/buscar")
    public ResponseEntity<List<ClienteResumenDTO>> buscarParaPOS(@RequestParam String q) {
        return ResponseEntity.ok(clienteService.buscarParaPOS(q));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(clienteService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<ClienteResponseDTO> crear(@Valid @RequestBody ClienteRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clienteService.crear(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> actualizar(@PathVariable Long id,
                                                          @Valid @RequestBody ClienteRequestDTO dto) {
        return ResponseEntity.ok(clienteService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        clienteService.desactivar(id);
        return ResponseEntity.noContent().build();
    }
}
