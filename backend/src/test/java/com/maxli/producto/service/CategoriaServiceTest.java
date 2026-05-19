package com.maxli.producto.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.CategoriaRequestDTO;
import com.maxli.producto.dto.CategoriaResponseDTO;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.mapper.CategoriaMapper;
import com.maxli.producto.repository.CategoriaRepository;
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
class CategoriaServiceTest {

    @Mock private CategoriaRepository categoriaRepository;
    @Mock private CategoriaMapper categoriaMapper;
    @InjectMocks private CategoriaService categoriaService;

    @Test
    void crear_guarda_y_retorna_dto() {
        CategoriaRequestDTO request = request();
        Categoria entity = categoria();
        Categoria saved = categoria();
        saved.setIdCategoria(1L);

        CategoriaResponseDTO expectedDto = new CategoriaResponseDTO();
        expectedDto.setIdCategoria(1L);
        expectedDto.setNombre("Ropa");
        expectedDto.setEstado("ACTIVO");

        when(categoriaRepository.existsByNombre("Ropa")).thenReturn(false);
        when(categoriaMapper.toEntity(request)).thenReturn(entity);
        when(categoriaRepository.save(entity)).thenReturn(saved);
        when(categoriaMapper.toDto(saved)).thenReturn(expectedDto);

        CategoriaResponseDTO result = categoriaService.crear(request);

        assertThat(result.getIdCategoria()).isEqualTo(1L);
        assertThat(result.getNombre()).isEqualTo("Ropa");
        verify(categoriaRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_nombre_ya_existe() {
        CategoriaRequestDTO request = request();
        when(categoriaRepository.existsByNombre("Ropa")).thenReturn(true);

        assertThatThrownBy(() -> categoriaService.crear(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("Ropa");
        verifyNoInteractions(categoriaMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Categoria categoria = categoria();
        categoria.setIdCategoria(1L);

        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));

        categoriaService.desactivar(1L);

        assertThat(categoria.getEstado()).isEqualTo("INACTIVO");
        verify(categoriaRepository).save(categoria);
    }

    @Test
    void desactivar_lanza_excepcion_si_categoria_no_existe() {
        when(categoriaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> categoriaService.desactivar(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private CategoriaRequestDTO request() {
        CategoriaRequestDTO request = new CategoriaRequestDTO();
        request.setNombre("Ropa");
        request.setDescripcion("Prendas de vestir");
        request.setEstado("ACTIVO");
        return request;
    }

    private Categoria categoria() {
        Categoria categoria = new Categoria();
        categoria.setNombre("Ropa");
        categoria.setDescripcion("Prendas de vestir");
        categoria.setEstado("ACTIVO");
        return categoria;
    }
}
