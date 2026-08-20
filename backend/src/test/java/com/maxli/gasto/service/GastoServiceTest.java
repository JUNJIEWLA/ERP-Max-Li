package com.maxli.gasto.service;

import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.BusinessException;
import com.maxli.gasto.dto.GastoRequestDTO;
import com.maxli.gasto.dto.GastoResponseDTO;
import com.maxli.gasto.entity.Gasto;
import com.maxli.gasto.mapper.GastoMapper;
import com.maxli.gasto.repository.GastoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GastoServiceTest {

    @Mock private GastoRepository gastoRepository;
    @Mock private OrdenCompraRepository ordenCompraRepository;
    @Mock private GastoMapper gastoMapper;

    @InjectMocks private GastoService gastoService;

    @Test
    void crear_registra_gasto_pendiente_por_el_total_de_una_orden_completada() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(10L);
        orden.setEstado("COMPLETADA");
        orden.setTotal(new BigDecimal("1250.50"));
        GastoRequestDTO request = new GastoRequestDTO();
        request.setIdOrdenCompra(10L);
        GastoResponseDTO response = new GastoResponseDTO();

        when(ordenCompraRepository.findById(10L)).thenReturn(Optional.of(orden));
        when(gastoRepository.existsByOrdenCompra_IdOrdenCompra(10L)).thenReturn(false);
        when(gastoRepository.save(any(Gasto.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(gastoMapper.toDto(any(Gasto.class))).thenReturn(response);

        GastoResponseDTO result = gastoService.crear(request);

        ArgumentCaptor<Gasto> captor = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoRepository).save(captor.capture());
        assertThat(result).isSameAs(response);
        assertThat(captor.getValue().getOrdenCompra()).isSameAs(orden);
        assertThat(captor.getValue().getMonto()).isEqualByComparingTo("1250.50");
        assertThat(captor.getValue().getEstado()).isEqualTo("PENDIENTE");
    }

    @Test
    void crear_usa_el_total_recepcionado_cuando_la_orden_cerro_con_faltantes() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(10L);
        orden.setEstado("COMPLETADA");
        orden.setTotal(new BigDecimal("10000.00"));          // lo pactado
        orden.setTotalRecepcionado(new BigDecimal("8000.00")); // lo que realmente llegó
        GastoRequestDTO request = new GastoRequestDTO();
        request.setIdOrdenCompra(10L);

        when(ordenCompraRepository.findById(10L)).thenReturn(Optional.of(orden));
        when(gastoRepository.existsByOrdenCompra_IdOrdenCompra(10L)).thenReturn(false);
        when(gastoRepository.save(any(Gasto.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(gastoMapper.toDto(any(Gasto.class))).thenReturn(new GastoResponseDTO());

        gastoService.crear(request);

        ArgumentCaptor<Gasto> captor = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoRepository).save(captor.capture());
        assertThat(captor.getValue().getMonto()).isEqualByComparingTo("8000.00");
    }

    @Test
    void crear_rechaza_una_orden_sin_recepcion_completa() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(10L);
        orden.setEstado("RECEPCION_PARCIAL");
        GastoRequestDTO request = new GastoRequestDTO();
        request.setIdOrdenCompra(10L);

        when(ordenCompraRepository.findById(10L)).thenReturn(Optional.of(orden));

        assertThatThrownBy(() -> gastoService.crear(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("completamente recepcionada");

        verify(gastoRepository, never()).save(any(Gasto.class));
    }
}
