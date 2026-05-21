package com.maxli.rol.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.rol.dto.RolRequestDTO;
import com.maxli.rol.dto.RolResponseDTO;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.mapper.RolMapper;
import com.maxli.rol.repository.RolRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RolServiceTest {

    @Mock private RolRepository rolRepository;
    @Mock private RolMapper rolMapper;
    @InjectMocks private RolService rolService;

    @Test
    void crear_guarda_rol_correctamente() {
        RolRequestDTO request = request("VENDEDOR");
        Rol entity = new Rol();
        entity.setNombre("VENDEDOR");
        Rol saved = new Rol();
        saved.setIdRol(1L);
        saved.setNombre("VENDEDOR");

        RolResponseDTO expectedDto = new RolResponseDTO();
        expectedDto.setIdRol(1L);
        expectedDto.setNombre("VENDEDOR");

        when(rolRepository.existsByNombre("VENDEDOR")).thenReturn(false);
        when(rolMapper.toEntity(request)).thenReturn(entity);
        when(rolRepository.save(entity)).thenReturn(saved);
        when(rolMapper.toDto(saved)).thenReturn(expectedDto);

        RolResponseDTO result = rolService.crear(request);

        assertThat(result.getIdRol()).isEqualTo(1L);
        assertThat(result.getNombre()).isEqualTo("VENDEDOR");
        verify(rolRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_nombre_ya_existe() {
        when(rolRepository.existsByNombre("ADMIN")).thenReturn(true);

        assertThatThrownBy(() -> rolService.crear(request("ADMIN")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("ADMIN");
    }

    @Test
    void actualizar_lanza_excepcion_si_nombre_pertenece_a_otro() {
        Rol existente = new Rol();
        existente.setIdRol(1L);
        existente.setNombre("CAJERO");

        when(rolRepository.findById(1L)).thenReturn(Optional.of(existente));
        when(rolRepository.existsByNombreAndIdRolNot("ADMIN", 1L)).thenReturn(true);

        assertThatThrownBy(() -> rolService.actualizar(1L, request("ADMIN")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("ADMIN");
    }

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(rolRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> rolService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void eliminar_invoca_delete() {
        Rol rol = new Rol();
        rol.setIdRol(1L);
        rol.setNombre("CAJERO");

        when(rolRepository.findById(1L)).thenReturn(Optional.of(rol));

        rolService.eliminar(1L);

        verify(rolRepository).delete(rol);
    }

    private RolRequestDTO request(String nombre) {
        RolRequestDTO dto = new RolRequestDTO();
        dto.setNombre(nombre);
        return dto;
    }
}
