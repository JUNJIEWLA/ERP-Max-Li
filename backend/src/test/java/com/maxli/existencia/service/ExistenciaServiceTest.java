package com.maxli.existencia.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.service.AlmacenService;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.existencia.dto.AjusteExistenciaRequestDTO;
import com.maxli.existencia.dto.CrearExistenciaRequestDTO;
import com.maxli.existencia.dto.ExistenciaResponseDTO;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.mapper.ExistenciaMapper;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.inventario.service.TrazabilidadInventarioService;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExistenciaServiceTest {

    @Mock private ExistenciaRepository existenciaRepository;
    @Mock private ExistenciaLockService existenciaLockService;
    @Mock private ProductoRepository productoRepository;
    @Mock private AlmacenService almacenService;
    @Mock private ExistenciaMapper existenciaMapper;
    @Mock private TrazabilidadInventarioService trazabilidadInventarioService;
    @InjectMocks private ExistenciaService existenciaService;

    @Test
    void crear_guarda_existencia_correctamente() {
        CrearExistenciaRequestDTO request = crearRequest();
        Producto producto = productoActivo();
        Existencia saved = new Existencia();
        saved.setIdExistencia(1L);

        ExistenciaResponseDTO expectedDto = new ExistenciaResponseDTO();
        expectedDto.setIdExistencia(1L);
        expectedDto.setIdProducto(10L);

        Almacen almacen = new Almacen();
        almacen.setIdAlmacen(1L);

        when(productoRepository.findById(10L)).thenReturn(Optional.of(producto));
        when(almacenService.obtenerEntidadPorId(any())).thenReturn(almacen);
        when(existenciaLockService.crearManualSiAusente(10L, 1L, 50, 10)).thenReturn(true);
        when(existenciaLockService.bloquear(10L, 1L)).thenReturn(Optional.of(saved));
        when(existenciaMapper.toDto(saved)).thenReturn(expectedDto);

        ExistenciaResponseDTO result = existenciaService.crear(request);

        assertThat(result.getIdExistencia()).isEqualTo(1L);
        assertThat(result.getIdProducto()).isEqualTo(10L);
    }

    @Test
    void crear_lanza_excepcion_si_producto_no_existe() {
        CrearExistenciaRequestDTO request = crearRequest();
        when(productoRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> existenciaService.crear(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("10");
    }

    @Test
    void crear_lanza_excepcion_si_producto_esta_inactivo() {
        CrearExistenciaRequestDTO request = crearRequest();
        Producto producto = productoActivo();
        producto.setEstado("INACTIVO");

        when(productoRepository.findById(10L)).thenReturn(Optional.of(producto));

        assertThatThrownBy(() -> existenciaService.crear(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("10");
    }

    @Test
    void crear_lanza_excepcion_si_existencia_ya_registrada() {
        CrearExistenciaRequestDTO request = crearRequest();
        Producto producto = productoActivo();

        when(productoRepository.findById(10L)).thenReturn(Optional.of(producto));
        when(almacenService.obtenerEntidadPorId(any())).thenReturn(new Almacen());
        when(existenciaLockService.crearManualSiAusente(10L, 1L, 50, 10)).thenReturn(false);

        assertThatThrownBy(() -> existenciaService.crear(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("este producto");
    }

    @Test
    void buscarPorId_lanza_excepcion_cuando_no_existe() {
        when(existenciaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> existenciaService.buscarPorId(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void actualizar_modifica_cantidades() {
        Existencia existencia = new Existencia();
        existencia.setIdExistencia(1L);
        existencia.setCantidadActual(5);
        existencia.setCantidadMinima(10);

        AjusteExistenciaRequestDTO request = ajusteRequest();
        request.setDeltaCantidadActual(15);
        request.setCantidadMinima(5);

        ExistenciaResponseDTO expectedDto = new ExistenciaResponseDTO();
        expectedDto.setCantidadActual(20);

        when(existenciaLockService.bloquearPorId(1L)).thenReturn(Optional.of(existencia));
        when(existenciaRepository.save(existencia)).thenReturn(existencia);
        when(existenciaMapper.toDto(existencia)).thenReturn(expectedDto);

        ExistenciaResponseDTO result = existenciaService.actualizar(1L, request);

        assertThat(existencia.getCantidadActual()).isEqualTo(20);
        assertThat(existencia.getCantidadMinima()).isEqualTo(5);
        verify(existenciaRepository).save(existencia);
    }

    private CrearExistenciaRequestDTO crearRequest() {
        CrearExistenciaRequestDTO dto = new CrearExistenciaRequestDTO();
        dto.setIdProducto(10L);
        dto.setIdAlmacen(1L);
        dto.setCantidadActual(50);
        dto.setCantidadMinima(10);
        return dto;
    }

    private AjusteExistenciaRequestDTO ajusteRequest() {
        AjusteExistenciaRequestDTO dto = new AjusteExistenciaRequestDTO();
        dto.setDeltaCantidadActual(15);
        dto.setCantidadMinima(5);
        return dto;
    }

    private Producto productoActivo() {
        Categoria categoria = new Categoria();
        categoria.setIdCategoria(1L);
        categoria.setNombre("Ropa");
        categoria.setEstado("ACTIVO");

        Marca marca = new Marca();
        marca.setIdMarca(1L);
        marca.setNombre("MaxLi");
        marca.setEstado("ACTIVO");

        Producto producto = new Producto();
        producto.setIdProducto(10L);
        producto.setSku("PRD-000010");
        producto.setNombre("Camiseta");
        producto.setPrecioVenta(new BigDecimal("299.00"));
        producto.setCosto(new BigDecimal("150.00"));
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        return producto;
    }
}
