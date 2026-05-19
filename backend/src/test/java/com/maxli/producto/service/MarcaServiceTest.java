package com.maxli.producto.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.MarcaRequestDTO;
import com.maxli.producto.dto.MarcaResponseDTO;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.mapper.MarcaMapper;
import com.maxli.producto.repository.MarcaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarcaServiceTest {

    @Mock private MarcaRepository marcaRepository;
    @Mock private MarcaMapper marcaMapper;
    @InjectMocks private MarcaService marcaService;

    @Test
    void crear_guarda_y_retorna_dto() {
        MarcaRequestDTO request = request();
        Marca entity = marca();
        Marca saved = marca();
        saved.setIdMarca(1L);

        MarcaResponseDTO expectedDto = new MarcaResponseDTO();
        expectedDto.setIdMarca(1L);
        expectedDto.setNombre("MaxLi");
        expectedDto.setEstado("ACTIVO");

        when(marcaRepository.existsByNombre("MaxLi")).thenReturn(false);
        when(marcaMapper.toEntity(request)).thenReturn(entity);
        when(marcaRepository.save(entity)).thenReturn(saved);
        when(marcaMapper.toDto(saved)).thenReturn(expectedDto);

        MarcaResponseDTO result = marcaService.crear(request);

        assertThat(result.getIdMarca()).isEqualTo(1L);
        assertThat(result.getNombre()).isEqualTo("MaxLi");
        verify(marcaRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_nombre_ya_existe() {
        MarcaRequestDTO request = request();
        when(marcaRepository.existsByNombre("MaxLi")).thenReturn(true);

        assertThatThrownBy(() -> marcaService.crear(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("MaxLi");
        verifyNoInteractions(marcaMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Marca marca = marca();
        marca.setIdMarca(1L);

        when(marcaRepository.findById(1L)).thenReturn(Optional.of(marca));

        marcaService.desactivar(1L);

        assertThat(marca.getEstado()).isEqualTo("INACTIVO");
        verify(marcaRepository).save(marca);
    }

    @Test
    void desactivar_lanza_excepcion_si_marca_no_existe() {
        when(marcaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> marcaService.desactivar(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private MarcaRequestDTO request() {
        MarcaRequestDTO request = new MarcaRequestDTO();
        request.setNombre("MaxLi");
        request.setDescripcion("Marca propia");
        request.setEstado("ACTIVO");
        return request;
    }

    private Marca marca() {
        Marca marca = new Marca();
        marca.setNombre("MaxLi");
        marca.setDescripcion("Marca propia");
        marca.setEstado("ACTIVO");
        return marca;
    }
}
