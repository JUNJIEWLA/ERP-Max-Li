package com.maxli.compra.service;

import com.maxli.compra.dto.OrdenCompraResponseDTO;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.mapper.OrdenCompraMapper;
import com.maxli.compra.repository.OrdenCompraRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cerrar una orden con faltantes no puede dejar el gasto en el monto pactado:
 * eso autorizaría pagar mercancía que nunca entró al almacén.
 */
@ExtendWith(MockitoExtension.class)
class OrdenCompraServiceForzarCierreTest {

    @Mock private OrdenCompraRepository ordenCompraRepository;
    @Mock private OrdenCompraMapper ordenCompraMapper;

    @InjectMocks private OrdenCompraService ordenCompraService;

    private DetalleOrdenCompra linea(int pedida, int recibida, String precio) {
        DetalleOrdenCompra d = new DetalleOrdenCompra();
        d.setCantidad(pedida);
        d.setCantidadRecibida(recibida);
        d.setPrecioUnitario(new BigDecimal(precio));
        return d;
    }

    @Test
    void forzar_cierre_fija_el_total_recepcionado_con_lo_que_realmente_llego() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(7L);
        orden.setEstado("RECEPCION_PARCIAL");
        orden.setTotal(new BigDecimal("10000.00"));
        orden.setDetalles(List.of(linea(100, 80, "100.00")));

        when(ordenCompraRepository.findById(7L)).thenReturn(Optional.of(orden));
        when(ordenCompraRepository.save(any(OrdenCompra.class))).thenAnswer(i -> i.getArgument(0));
        when(ordenCompraMapper.toDto(any(OrdenCompra.class))).thenReturn(new OrdenCompraResponseDTO());

        ordenCompraService.forzarCierre(7L);

        ArgumentCaptor<OrdenCompra> captor = ArgumentCaptor.forClass(OrdenCompra.class);
        verify(ordenCompraRepository).save(captor.capture());
        OrdenCompra guardada = captor.getValue();

        assertThat(guardada.getEstado()).isEqualTo("COMPLETADA");
        assertThat(guardada.getTotalRecepcionado()).isEqualByComparingTo("8000.00");
        assertThat(guardada.getTotalAPagar()).isEqualByComparingTo("8000.00");
        // El monto pactado se conserva: es el rastro de la diferencia negociada.
        assertThat(guardada.getTotal()).isEqualByComparingTo("10000.00");
    }

    @Test
    void forzar_cierre_de_una_orden_recibida_entera_no_cambia_el_monto() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(8L);
        orden.setEstado("ENVIADA");
        orden.setTotal(new BigDecimal("1500.00"));
        orden.setDetalles(List.of(linea(10, 10, "100.00"), linea(5, 5, "100.00")));

        when(ordenCompraRepository.findById(8L)).thenReturn(Optional.of(orden));
        when(ordenCompraRepository.save(any(OrdenCompra.class))).thenAnswer(i -> i.getArgument(0));
        when(ordenCompraMapper.toDto(any(OrdenCompra.class))).thenReturn(new OrdenCompraResponseDTO());

        ordenCompraService.forzarCierre(8L);

        ArgumentCaptor<OrdenCompra> captor = ArgumentCaptor.forClass(OrdenCompra.class);
        verify(ordenCompraRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalAPagar()).isEqualByComparingTo("1500.00");
    }

    @Test
    void forzar_cierre_sin_ninguna_recepcion_deja_el_monto_a_pagar_en_cero() {
        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(9L);
        orden.setEstado("ENVIADA");
        orden.setTotal(new BigDecimal("500.00"));
        orden.setDetalles(List.of(linea(5, 0, "100.00")));

        when(ordenCompraRepository.findById(9L)).thenReturn(Optional.of(orden));
        when(ordenCompraRepository.save(any(OrdenCompra.class))).thenAnswer(i -> i.getArgument(0));
        when(ordenCompraMapper.toDto(any(OrdenCompra.class))).thenReturn(new OrdenCompraResponseDTO());

        ordenCompraService.forzarCierre(9L);

        ArgumentCaptor<OrdenCompra> captor = ArgumentCaptor.forClass(OrdenCompra.class);
        verify(ordenCompraRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalAPagar()).isEqualByComparingTo("0.00");
    }
}
