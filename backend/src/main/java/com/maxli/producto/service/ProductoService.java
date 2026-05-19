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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductoService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";

    private final ProductoRepository productoRepository;
    private final CategoriaRepository categoriaRepository;
    private final MarcaRepository marcaRepository;
    private final ProductoMapper productoMapper;

    @Transactional(readOnly = true)
    public Page<ProductoResponseDTO> listar(Pageable pageable) {
        return productoRepository.findAll(pageable).map(productoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ProductoResponseDTO> listarActivos(Pageable pageable) {
        return productoRepository.findByEstado(ACTIVO, pageable).map(productoMapper::toDto);
    }

    @Transactional(readOnly = true)
    public ProductoResponseDTO buscarPorId(Long id) {
        Producto producto = obtenerPorId(id);
        return productoMapper.toDto(producto);
    }

    @Transactional(readOnly = true)
    public ProductoResponseDTO buscarPorCodigo(String codigo) {
        Producto producto = productoRepository.findByCodigo(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con codigo: " + codigo));
        return productoMapper.toDto(producto);
    }

    @Transactional
    public ProductoResponseDTO crear(ProductoRequestDTO dto) {
        validarCodigoDisponible(dto.getCodigo());
        Categoria categoria = obtenerCategoriaActiva(dto.getIdCategoria());
        Marca marca = obtenerMarcaActiva(dto.getIdMarca());
        Producto producto = productoMapper.toEntity(dto, categoria, marca);
        return productoMapper.toDto(productoRepository.save(producto));
    }

    @Transactional
    public ProductoResponseDTO actualizar(Long id, ProductoRequestDTO dto) {
        Producto producto = obtenerPorId(id);
        validarCodigoDisponibleParaActualizar(dto.getCodigo(), id);
        Categoria categoria = obtenerCategoriaActiva(dto.getIdCategoria());
        Marca marca = obtenerMarcaActiva(dto.getIdMarca());

        producto.setCodigo(dto.getCodigo());
        producto.setNombre(dto.getNombre());
        producto.setDescripcion(dto.getDescripcion());
        producto.setPrecioVenta(dto.getPrecioVenta());
        producto.setCosto(dto.getCosto());
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        if (dto.getEstado() != null) {
            producto.setEstado(dto.getEstado());
        }

        return productoMapper.toDto(productoRepository.save(producto));
    }

    @Transactional
    public void desactivar(Long id) {
        Producto producto = obtenerPorId(id);
        producto.setEstado(INACTIVO);
        productoRepository.save(producto);
    }

    private Producto obtenerPorId(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con id: " + id));
    }

    private Categoria obtenerCategoriaActiva(Long idCategoria) {
        return categoriaRepository.findById(idCategoria)
                .filter(categoria -> ACTIVO.equals(categoria.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException("Categoria no encontrada o inactiva con id: " + idCategoria));
    }

    private Marca obtenerMarcaActiva(Long idMarca) {
        return marcaRepository.findById(idMarca)
                .filter(marca -> ACTIVO.equals(marca.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException("Marca no encontrada o inactiva con id: " + idMarca));
    }

    private void validarCodigoDisponible(String codigo) {
        if (productoRepository.existsByCodigo(codigo)) {
            throw new DuplicateResourceException("Ya existe un producto con codigo: " + codigo);
        }
    }

    private void validarCodigoDisponibleParaActualizar(String codigo, Long idProducto) {
        if (productoRepository.existsByCodigoAndIdProductoNot(codigo, idProducto)) {
            throw new DuplicateResourceException("Ya existe un producto con codigo: " + codigo);
        }
    }
}
