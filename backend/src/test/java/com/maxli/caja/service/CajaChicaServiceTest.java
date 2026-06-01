package com.maxli.caja.service;

import com.maxli.caja.dto.CajaChicaRequestDTO;
import com.maxli.caja.dto.CajaChicaResponseDTO;
import com.maxli.caja.entity.CajaChica;
import com.maxli.caja.mapper.CajaChicaMapper;
import com.maxli.caja.repository.CajaChicaRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CajaChicaServiceTest {

    @Mock private CajaChicaRepository cajaChicaRepository;
    @Mock private CajaChicaMapper cajaChicaMapper;
    @InjectMocks private CajaChicaService cajaChicaService;

    @Test
    void crear_guarda_caja_chica_activa() {
        CajaChicaRequestDTO request = request();
        CajaChica entity = entity();
        CajaChica saved = entity();
        saved.setIdCajaChica(1L);
        CajaChicaResponseDTO expectedDto = response(1L, "ACTIVO");

        when(cajaChicaRepository.existsByNombre("Caja Chica Admin")).thenReturn(false);
        when(cajaChicaMapper.toEntity(request)).thenReturn(entity);
        when(cajaChicaRepository.save(entity)).thenReturn(saved);
        when(cajaChicaMapper.toDto(saved)).thenReturn(expectedDto);

        CajaChicaResponseDTO result = cajaChicaService.crear(request);

        assertThat(result.getIdCajaChica()).isEqualTo(1L);
        assertThat(result.getEstado()).isEqualTo("ACTIVO");
        verify(cajaChicaRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_nombre_ya_existe() {
        when(cajaChicaRepository.existsByNombre("Caja Chica Admin")).thenReturn(true);

        assertThatThrownBy(() -> cajaChicaService.crear(request()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("Caja Chica Admin");

        verifyNoInteractions(cajaChicaMapper);
    }

    @Test
    void crear_lanza_excepcion_si_saldo_supera_limite() {
        CajaChicaRequestDTO request = request();
        request.setSaldoActual(new BigDecimal("12000.00"));

        when(cajaChicaRepository.existsByNombre("Caja Chica Admin")).thenReturn(false);

        assertThatThrownBy(() -> cajaChicaService.crear(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("limite");

        verifyNoInteractions(cajaChicaMapper);
    }

    @Test
    void actualizar_lanza_excepcion_si_nombre_pertenece_a_otra_caja_chica() {
        when(cajaChicaRepository.findById(1L)).thenReturn(Optional.of(entity()));
        when(cajaChicaRepository.existsByNombreAndIdCajaChicaNot("Caja Chica Admin", 1L)).thenReturn(true);

        assertThatThrownBy(() -> cajaChicaService.actualizar(1L, request()))
                .isInstanceOf(DuplicateResourceException.class);

        verifyNoInteractions(cajaChicaMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        CajaChica cajaChica = entity();
        cajaChica.setIdCajaChica(1L);

        when(cajaChicaRepository.findById(1L)).thenReturn(Optional.of(cajaChica));
        when(cajaChicaRepository.save(cajaChica)).thenReturn(cajaChica);

        cajaChicaService.desactivar(1L);

        assertThat(cajaChica.getEstado()).isEqualTo("INACTIVO");
        verify(cajaChicaRepository).save(cajaChica);
    }

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(cajaChicaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cajaChicaService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    private CajaChicaRequestDTO request() {
        CajaChicaRequestDTO request = new CajaChicaRequestDTO();
        request.setNombre("Caja Chica Admin");
        request.setResponsable("Admin");
        request.setSaldoActual(new BigDecimal("8500.00"));
        request.setLimiteMonto(new BigDecimal("10000.00"));
        request.setEstado("ACTIVO");
        return request;
    }

    private CajaChica entity() {
        CajaChica cajaChica = new CajaChica();
        cajaChica.setNombre("Caja Chica Admin");
        cajaChica.setResponsable("Admin");
        cajaChica.setSaldoActual(new BigDecimal("8500.00"));
        cajaChica.setLimiteMonto(new BigDecimal("10000.00"));
        cajaChica.setEstado("ACTIVO");
        return cajaChica;
    }

    private CajaChicaResponseDTO response(Long id, String estado) {
        CajaChicaResponseDTO response = new CajaChicaResponseDTO();
        response.setIdCajaChica(id);
        response.setEstado(estado);
        return response;
    }
}
