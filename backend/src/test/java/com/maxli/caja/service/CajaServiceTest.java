package com.maxli.caja.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.caja.dto.CajaRequestDTO;
import com.maxli.caja.dto.CajaResponseDTO;
import com.maxli.caja.entity.Caja;
import com.maxli.caja.mapper.CajaMapper;
import com.maxli.caja.repository.CajaRepository;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CajaServiceTest {

    @Mock private CajaRepository cajaRepository;
    @Mock private CajaMapper cajaMapper;
    @Mock private AlmacenRepository almacenRepository;
    @InjectMocks private CajaService cajaService;

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(cajaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cajaService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void crear_guarda_y_retorna_dto() {
        CajaRequestDTO request = new CajaRequestDTO();
        request.setNombre("Caja Principal");
        request.setEstado("ACTIVO");
        request.setIdAlmacen(5L);

        Caja entity = new Caja();
        entity.setNombre("Caja Principal");
        entity.setEstado("ACTIVO");

        Almacen almacen = new Almacen();
        almacen.setIdAlmacen(5L);
        almacen.setNombre("Almacen Principal");
        almacen.setEstado("ACTIVO");

        Caja saved = new Caja();
        saved.setIdCaja(1L);
        saved.setNombre("Caja Principal");
        saved.setEstado("ACTIVO");
        saved.setAlmacen(almacen);

        CajaResponseDTO expectedDto = new CajaResponseDTO();
        expectedDto.setIdCaja(1L);
        expectedDto.setNombre("Caja Principal");
        expectedDto.setEstado("ACTIVO");

        when(cajaRepository.existsByNombreAndEstado("Caja Principal", "ACTIVO")).thenReturn(false);
        when(cajaMapper.toEntity(request)).thenReturn(entity);
        when(almacenRepository.findById(5L)).thenReturn(Optional.of(almacen));
        when(cajaRepository.save(entity)).thenReturn(saved);
        when(cajaMapper.toDto(saved)).thenReturn(expectedDto);

        CajaResponseDTO result = cajaService.crear(request);

        assertThat(result.getIdCaja()).isEqualTo(1L);
        assertThat(result.getNombre()).isEqualTo("Caja Principal");
        verify(cajaRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_existe_caja_activa_con_mismo_nombre() {
        CajaRequestDTO request = new CajaRequestDTO();
        request.setNombre("Caja Principal");
        request.setEstado("ACTIVO");

        when(cajaRepository.existsByNombreAndEstado("Caja Principal", "ACTIVO")).thenReturn(true);

        assertThatThrownBy(() -> cajaService.crear(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("Caja Principal");
        verifyNoInteractions(cajaMapper);
    }

    @Test
    void actualizar_lanza_excepcion_si_otro_registro_activo_tiene_mismo_nombre() {
        CajaRequestDTO request = new CajaRequestDTO();
        request.setNombre("Caja Principal");
        request.setEstado("ACTIVO");

        Caja caja = new Caja();
        caja.setIdCaja(1L);
        caja.setNombre("Caja 1");
        caja.setEstado("ACTIVO");

        when(cajaRepository.findById(1L)).thenReturn(Optional.of(caja));
        when(cajaRepository.existsByNombreAndEstadoAndIdCajaNot("Caja Principal", "ACTIVO", 1L)).thenReturn(true);

        assertThatThrownBy(() -> cajaService.actualizar(1L, request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("Caja Principal");
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Caja caja = new Caja();
        caja.setIdCaja(1L);
        caja.setEstado("ACTIVO");

        when(cajaRepository.findById(1L)).thenReturn(Optional.of(caja));
        when(cajaRepository.save(any(Caja.class))).thenReturn(caja);

        cajaService.desactivar(1L);

        assertThat(caja.getEstado()).isEqualTo("INACTIVO");
        verify(cajaRepository).save(caja);
    }

    @Test
    void desactivar_lanza_excepcion_si_caja_no_existe() {
        when(cajaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cajaService.desactivar(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
