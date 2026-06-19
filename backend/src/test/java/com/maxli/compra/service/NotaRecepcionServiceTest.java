package com.maxli.compra.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.almacen.repository.AlmacenRepository;
import com.maxli.compra.dto.NotaRecepcionResponseDTO;
import com.maxli.compra.entity.DetalleNotaRecepcion;
import com.maxli.compra.entity.DetalleOrdenCompra;
import com.maxli.compra.entity.NotaRecepcion;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.entity.Proveedor;
import com.maxli.compra.mapper.NotaRecepcionMapper;
import com.maxli.compra.repository.DetalleOrdenCompraRepository;
import com.maxli.compra.repository.NotaRecepcionRepository;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.BusinessException;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.AlertaCostoRepository;
import com.maxli.producto.repository.HistorialCostoRepository;
import com.maxli.producto.repository.ProductoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotaRecepcionServiceTest {

    @Mock private NotaRecepcionRepository notaRecepcionRepository;
    @Mock private OrdenCompraRepository ordenCompraRepository;
    @Mock private DetalleOrdenCompraRepository detalleOrdenCompraRepository;
    @Mock private ExistenciaRepository existenciaRepository;
    @Mock private AlmacenRepository almacenRepository;
    @Mock private ProductoRepository productoRepository;
    @Mock private HistorialCostoRepository historialCostoRepository;
    @Mock private AlertaCostoRepository alertaCostoRepository;
    @Mock private OrdenCompraService ordenCompraService;
    @Mock private NotaRecepcionMapper notaRecepcionMapper;

    @InjectMocks private NotaRecepcionService notaRecepcionService;

    @Test
    void confirmar_actualiza_stock_en_almacen_correcto() {
        // Arrange
        Long idNota = 1L;
        Long idProducto = 10L;
        Long idAlmacenA = 101L;
        Long idAlmacenB = 102L;

        Almacen almacenA = new Almacen();
        almacenA.setIdAlmacen(idAlmacenA);
        almacenA.setNombre("Almacén A");
        almacenA.setEstado("ACTIVO");

        Almacen almacenB = new Almacen();
        almacenB.setIdAlmacen(idAlmacenB);
        almacenB.setNombre("Almacén B");
        almacenB.setEstado("ACTIVO");

        Proveedor proveedor = new Proveedor();
        proveedor.setIdProveedor(5L);

        Categoria categoria = new Categoria();
        categoria.setIdCategoria(2L);
        categoria.setPorcentajeMargen(new BigDecimal("30"));

        Producto producto = new Producto();
        producto.setIdProducto(idProducto);
        producto.setNombre("Camiseta");
        producto.setCosto(new BigDecimal("100"));
        producto.setPrecioVenta(new BigDecimal("150"));
        producto.setCategoria(categoria);

        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(100L);
        orden.setProveedor(proveedor);

        DetalleOrdenCompra detalleOrden = new DetalleOrdenCompra();
        detalleOrden.setIdDetalleOrdenCompra(200L);
        detalleOrden.setOrdenCompra(orden);
        detalleOrden.setProducto(producto);
        detalleOrden.setCantidad(10);
        detalleOrden.setPrecioUnitario(new BigDecimal("100"));
        detalleOrden.setCantidadRecibida(0);

        DetalleNotaRecepcion detalleNota = new DetalleNotaRecepcion();
        detalleNota.setIdDetalleNotaRecepcion(300L);
        detalleNota.setDetalleOrdenCompra(detalleOrden);
        detalleNota.setCantidadRecibida(5);
        detalleNota.setObservacion("CONFORME");
        // Destinado al Almacén B
        detalleNota.setAlmacen(almacenB);

        NotaRecepcion nota = new NotaRecepcion();
        nota.setIdNotaRecepcion(idNota);
        nota.setOrdenCompra(orden);
        nota.setEstado("PENDIENTE");
        nota.getDetalles().add(detalleNota);

        Existencia existenciaB = new Existencia();
        existenciaB.setIdExistencia(500L);
        existenciaB.setProducto(producto);
        existenciaB.setAlmacen(almacenB);
        existenciaB.setCantidadActual(12);

        when(notaRecepcionRepository.findById(idNota)).thenReturn(Optional.of(nota));
        // Debe buscar la existencia específicamente en el Almacén B
        when(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenB))
                .thenReturn(Optional.of(existenciaB));
        when(existenciaRepository.save(any(Existencia.class))).thenAnswer(i -> i.getArgument(0));
        when(detalleOrdenCompraRepository.findByOrdenCompra_IdOrdenCompra(100L)).thenReturn(List.of(detalleOrden));
        when(notaRecepcionMapper.toDto(any(NotaRecepcion.class))).thenReturn(new NotaRecepcionResponseDTO());

        // Act
        notaRecepcionService.confirmar(idNota);

        // Assert
        // Verificamos que el stock se incrementó en la existencia del Almacén B
        assertThat(existenciaB.getCantidadActual()).isEqualTo(17);
        verify(existenciaRepository).save(existenciaB);
        // Verificamos que no se buscó en el Almacén A
        verify(existenciaRepository, never()).findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacenA);
    }

    @Test
    void confirmar_resuelve_concurrencia_al_inicializar_existencia() {
        // Arrange
        Long idNota = 1L;
        Long idProducto = 10L;
        Long idAlmacen = 102L;

        Almacen almacen = new Almacen();
        almacen.setIdAlmacen(idAlmacen);
        almacen.setNombre("Almacén B");
        almacen.setEstado("ACTIVO");

        Proveedor proveedor = new Proveedor();
        proveedor.setIdProveedor(5L);

        Categoria categoria = new Categoria();
        categoria.setIdCategoria(2L);
        categoria.setPorcentajeMargen(new BigDecimal("30"));

        Producto producto = new Producto();
        producto.setIdProducto(idProducto);
        producto.setNombre("Camiseta");
        producto.setCosto(new BigDecimal("100"));
        producto.setPrecioVenta(new BigDecimal("150"));
        producto.setCategoria(categoria);

        OrdenCompra orden = new OrdenCompra();
        orden.setIdOrdenCompra(100L);
        orden.setProveedor(proveedor);

        DetalleOrdenCompra detalleOrden = new DetalleOrdenCompra();
        detalleOrden.setIdDetalleOrdenCompra(200L);
        detalleOrden.setOrdenCompra(orden);
        detalleOrden.setProducto(producto);
        detalleOrden.setCantidad(10);
        detalleOrden.setPrecioUnitario(new BigDecimal("100"));
        detalleOrden.setCantidadRecibida(0);

        DetalleNotaRecepcion detalleNota = new DetalleNotaRecepcion();
        detalleNota.setIdDetalleNotaRecepcion(300L);
        detalleNota.setDetalleOrdenCompra(detalleOrden);
        detalleNota.setCantidadRecibida(5);
        detalleNota.setObservacion("CONFORME");
        detalleNota.setAlmacen(almacen);

        NotaRecepcion nota = new NotaRecepcion();
        nota.setIdNotaRecepcion(idNota);
        nota.setOrdenCompra(orden);
        nota.setEstado("PENDIENTE");
        nota.getDetalles().add(detalleNota);

        Existencia existenciaExistente = new Existencia();
        existenciaExistente.setIdExistencia(500L);
        existenciaExistente.setProducto(producto);
        existenciaExistente.setAlmacen(almacen);
        existenciaExistente.setCantidadActual(10);

        when(notaRecepcionRepository.findById(idNota)).thenReturn(Optional.of(nota));
        // Primera consulta devuelve vacío (simulando que no existe todavía en la base de datos)
        when(existenciaRepository.findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacen))
                .thenReturn(Optional.empty()) // primer lookup para orElseGet
                .thenReturn(Optional.of(existenciaExistente)); // lookup de recuperación en el catch block

        // El primer saveAndFlush lanza la excepción de duplicidad de clave (DataIntegrityViolationException)
        when(existenciaRepository.saveAndFlush(any(Existencia.class)))
                .thenThrow(new DataIntegrityViolationException("Llave duplicada"));

        when(existenciaRepository.save(any(Existencia.class))).thenAnswer(i -> i.getArgument(0));
        when(detalleOrdenCompraRepository.findByOrdenCompra_IdOrdenCompra(100L)).thenReturn(List.of(detalleOrden));
        when(notaRecepcionMapper.toDto(any(NotaRecepcion.class))).thenReturn(new NotaRecepcionResponseDTO());

        // Act
        notaRecepcionService.confirmar(idNota);

        // Assert
        // Verificamos que se recuperó la existencia existente y se le sumó la cantidad
        assertThat(existenciaExistente.getCantidadActual()).isEqualTo(15);
        verify(existenciaRepository).save(existenciaExistente);
        // Verificamos que se consultó dos veces a la base de datos por la existencia (antes y después del error)
        verify(existenciaRepository, times(2)).findByProducto_IdProductoAndAlmacen_IdAlmacen(idProducto, idAlmacen);
    }
}
