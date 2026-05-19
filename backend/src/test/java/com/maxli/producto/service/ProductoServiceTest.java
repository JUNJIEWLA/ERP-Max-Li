package com.maxli.producto.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.dto.ProductoRequestDTO;
import com.maxli.producto.dto.ProductoResponseDTO;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.mapper.ProductoMapper;
import com.maxli.producto.repository.CategoriaRepository;
import com.maxli.producto.repository.MarcaRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductoServiceTest {

    @Mock private ProductoRepository productoRepository;
    @Mock private CategoriaRepository categoriaRepository;
    @Mock private MarcaRepository marcaRepository;
    @Mock private ProductoMapper productoMapper;
    @InjectMocks private ProductoService productoService;

    @Test
    void buscarPorCodigo_lanza_excepcion_cuando_no_existe() {
        when(productoRepository.findByCodigo("P-999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productoService.buscarPorCodigo("P-999"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("P-999");
    }

    @Test
    void crear_guarda_producto_con_categoria_y_marca() {
        ProductoRequestDTO request = request();
        Categoria categoria = categoriaActiva();
        Marca marca = marcaActiva();
        Producto entity = producto(categoria, marca);
        Producto saved = producto(categoria, marca);
        saved.setIdProducto(1L);

        ProductoResponseDTO expectedDto = new ProductoResponseDTO();
        expectedDto.setIdProducto(1L);
        expectedDto.setCodigo("P-001");
        expectedDto.setNombre("Camiseta basica");
        expectedDto.setIdCategoria(10L);
        expectedDto.setCategoriaNombre("Ropa");
        expectedDto.setIdMarca(20L);
        expectedDto.setMarcaNombre("MaxLi");

        when(productoRepository.existsByCodigo("P-001")).thenReturn(false);
        when(categoriaRepository.findById(10L)).thenReturn(Optional.of(categoria));
        when(marcaRepository.findById(20L)).thenReturn(Optional.of(marca));
        when(productoMapper.toEntity(request, categoria, marca)).thenReturn(entity);
        when(productoRepository.save(entity)).thenReturn(saved);
        when(productoMapper.toDto(saved)).thenReturn(expectedDto);

        ProductoResponseDTO result = productoService.crear(request);

        assertThat(result.getIdProducto()).isEqualTo(1L);
        assertThat(result.getCodigo()).isEqualTo("P-001");
        assertThat(result.getCategoriaNombre()).isEqualTo("Ropa");
        assertThat(result.getMarcaNombre()).isEqualTo("MaxLi");
        verify(productoRepository).save(entity);
    }

    @Test
    void crear_lanza_excepcion_si_codigo_ya_existe() {
        ProductoRequestDTO request = request();
        when(productoRepository.existsByCodigo("P-001")).thenReturn(true);

        assertThatThrownBy(() -> productoService.crear(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("P-001");
        verifyNoInteractions(categoriaRepository, marcaRepository, productoMapper);
    }

    @Test
    void crear_lanza_excepcion_si_categoria_esta_inactiva() {
        ProductoRequestDTO request = request();
        Categoria categoria = categoriaActiva();
        categoria.setEstado("INACTIVO");

        when(productoRepository.existsByCodigo("P-001")).thenReturn(false);
        when(categoriaRepository.findById(10L)).thenReturn(Optional.of(categoria));

        assertThatThrownBy(() -> productoService.crear(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("10");
        verifyNoInteractions(marcaRepository, productoMapper);
    }

    @Test
    void crear_lanza_excepcion_si_marca_esta_inactiva() {
        ProductoRequestDTO request = request();
        Marca marca = marcaActiva();
        marca.setEstado("INACTIVO");

        when(productoRepository.existsByCodigo("P-001")).thenReturn(false);
        when(categoriaRepository.findById(10L)).thenReturn(Optional.of(categoriaActiva()));
        when(marcaRepository.findById(20L)).thenReturn(Optional.of(marca));

        assertThatThrownBy(() -> productoService.crear(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("20");
        verifyNoInteractions(productoMapper);
    }

    @Test
    void actualizar_lanza_excepcion_si_codigo_pertenece_a_otro_producto() {
        ProductoRequestDTO request = request();
        Producto producto = producto(categoriaActiva(), marcaActiva());
        producto.setIdProducto(1L);

        when(productoRepository.findById(1L)).thenReturn(Optional.of(producto));
        when(productoRepository.existsByCodigoAndIdProductoNot("P-001", 1L)).thenReturn(true);

        assertThatThrownBy(() -> productoService.actualizar(1L, request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("P-001");
        verifyNoInteractions(categoriaRepository, marcaRepository, productoMapper);
    }

    @Test
    void desactivar_cambia_estado_a_inactivo() {
        Producto producto = producto(categoriaActiva(), marcaActiva());
        producto.setIdProducto(1L);
        producto.setEstado("ACTIVO");

        when(productoRepository.findById(1L)).thenReturn(Optional.of(producto));

        productoService.desactivar(1L);

        assertThat(producto.getEstado()).isEqualTo("INACTIVO");
        verify(productoRepository).save(producto);
    }

    private ProductoRequestDTO request() {
        ProductoRequestDTO request = new ProductoRequestDTO();
        request.setCodigo("P-001");
        request.setNombre("Camiseta basica");
        request.setDescripcion("Camiseta de algodon");
        request.setPrecioVenta(new BigDecimal("499.00"));
        request.setCosto(new BigDecimal("250.00"));
        request.setEstado("ACTIVO");
        request.setIdCategoria(10L);
        request.setIdMarca(20L);
        return request;
    }

    private Categoria categoriaActiva() {
        Categoria categoria = new Categoria();
        categoria.setIdCategoria(10L);
        categoria.setNombre("Ropa");
        categoria.setEstado("ACTIVO");
        return categoria;
    }

    private Marca marcaActiva() {
        Marca marca = new Marca();
        marca.setIdMarca(20L);
        marca.setNombre("MaxLi");
        marca.setEstado("ACTIVO");
        return marca;
    }

    private Producto producto(Categoria categoria, Marca marca) {
        Producto producto = new Producto();
        producto.setCodigo("P-001");
        producto.setNombre("Camiseta basica");
        producto.setDescripcion("Camiseta de algodon");
        producto.setPrecioVenta(new BigDecimal("499.00"));
        producto.setCosto(new BigDecimal("250.00"));
        producto.setEstado("ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        return producto;
    }
}
