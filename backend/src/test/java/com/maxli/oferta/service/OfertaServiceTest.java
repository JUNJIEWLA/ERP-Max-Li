package com.maxli.oferta.service;

import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.oferta.dto.OfertaRequestDTO;
import com.maxli.oferta.dto.OfertaResponseDTO;
import com.maxli.oferta.entity.Oferta;
import com.maxli.oferta.mapper.OfertaMapper;
import com.maxli.oferta.repository.OfertaRepository;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OfertaServiceTest {

    @Mock private OfertaRepository ofertaRepository;
    @Mock private ProductoRepository productoRepository;
    @Mock private OfertaMapper ofertaMapper;
    @InjectMocks private OfertaService ofertaService;

    @Test
    void crear_oferta_cantidad_guarda_con_producto_activo() {
        OfertaRequestDTO request = requestCantidad();
        Producto producto = productoActivo();
        Oferta oferta = new Oferta();
        Oferta saved = new Oferta();
        saved.setIdOferta(1L);
        OfertaResponseDTO response = new OfertaResponseDTO();
        response.setIdOferta(1L);
        response.setTipo("CANTIDAD");
        response.setCantidadRequerida(3);
        response.setCantidadPagada(2);

        when(productoRepository.findById(10L)).thenReturn(Optional.of(producto));
        when(ofertaMapper.toEntity(request, producto)).thenReturn(oferta);
        when(ofertaRepository.save(oferta)).thenReturn(saved);
        when(ofertaMapper.toDto(saved)).thenReturn(response);

        OfertaResponseDTO result = ofertaService.crear(request);

        assertThat(result.getIdOferta()).isEqualTo(1L);
        assertThat(result.getTipo()).isEqualTo("CANTIDAD");
        assertThat(result.getCantidadPagada()).isEqualTo(2);
        verify(ofertaRepository).save(oferta);
    }

    @Test
    void crear_lanza_excepcion_si_fecha_fin_es_anterior_a_inicio() {
        OfertaRequestDTO request = requestDescuento();
        request.setFechaInicio(LocalDate.of(2026, 7, 10));
        request.setFechaFin(LocalDate.of(2026, 7, 9));

        assertThatThrownBy(() -> ofertaService.crear(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("fecha fin");
        verifyNoInteractions(productoRepository, ofertaRepository, ofertaMapper);
    }

    @Test
    void crear_lanza_excepcion_si_cantidad_pagada_no_es_menor() {
        OfertaRequestDTO request = requestCantidad();
        request.setCantidadPagada(3);

        assertThatThrownBy(() -> ofertaService.crear(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("cantidad pagada");
        verifyNoInteractions(productoRepository, ofertaRepository, ofertaMapper);
    }

    @Test
    void crear_lanza_excepcion_si_producto_esta_inactivo() {
        OfertaRequestDTO request = requestDescuento();
        Producto producto = productoActivo();
        producto.setEstado("INACTIVO");

        when(productoRepository.findById(10L)).thenReturn(Optional.of(producto));

        assertThatThrownBy(() -> ofertaService.crear(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("10");
        verifyNoInteractions(ofertaRepository, ofertaMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Oferta oferta = new Oferta();
        oferta.setIdOferta(1L);
        oferta.setEstado("ACTIVO");

        when(ofertaRepository.findById(1L)).thenReturn(Optional.of(oferta));

        ofertaService.desactivar(1L);

        assertThat(oferta.getEstado()).isEqualTo("INACTIVO");
        verify(ofertaRepository).save(oferta);
    }

    private OfertaRequestDTO requestCantidad() {
        OfertaRequestDTO request = baseRequest();
        request.setTipo("CANTIDAD");
        request.setCantidadRequerida(3);
        request.setCantidadPagada(2);
        return request;
    }

    private OfertaRequestDTO requestDescuento() {
        OfertaRequestDTO request = baseRequest();
        request.setTipo("DESCUENTO");
        request.setPorcentajeDescuento(new java.math.BigDecimal("15.00"));
        return request;
    }

    private OfertaRequestDTO baseRequest() {
        OfertaRequestDTO request = new OfertaRequestDTO();
        request.setNombre("Promo julio");
        request.setDescripcion("Oferta temporal");
        request.setIdProducto(10L);
        request.setFechaInicio(LocalDate.of(2026, 7, 1));
        request.setFechaFin(LocalDate.of(2026, 7, 31));
        request.setEstado("ACTIVO");
        return request;
    }

    private Producto productoActivo() {
        Categoria categoria = new Categoria();
        categoria.setIdCategoria(1L);
        categoria.setNombre("Alimentos");
        Marca marca = new Marca();
        marca.setIdMarca(1L);
        marca.setNombre("MaxLi");
        Producto producto = new Producto();
        producto.setIdProducto(10L);
        producto.setSku("PRD-000010");
        producto.setNombre("Galletas");
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        return producto;
    }
}
