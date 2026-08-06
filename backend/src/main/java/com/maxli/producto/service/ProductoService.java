package com.maxli.producto.service;

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

import java.math.BigDecimal;
import com.maxli.existencia.entity.Existencia;
import com.maxli.existencia.repository.ExistenciaRepository;
import org.springframework.data.domain.PageRequest;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductoService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";
    private static final BigDecimal CIEN = new BigDecimal("100");

    private final ProductoRepository productoRepository;
    private final CategoriaRepository categoriaRepository;
    private final MarcaRepository marcaRepository;
    private final ExistenciaRepository existenciaRepository;
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
        return productoMapper.toDto(obtenerPorId(id));
    }

    @Transactional(readOnly = true)
    public ProductoResponseDTO buscarPorSku(String sku) {
        Producto producto = productoRepository.findBySku(sku)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con SKU: " + sku));
        return productoMapper.toDto(producto);
    }

    @Transactional(readOnly = true)
    public List<ProductoResponseDTO> buscarPorCodigoBarras(String codigoBarras) {
        return productoRepository.findByCodigoBarras(codigoBarras)
                .stream()
                .map(productoMapper::toDto)
                .toList();
    }

    /**
     * Búsqueda para el POS: busca por nombre, SKU o código de barras (solo productos ACTIVOS).
     * Devuelve máximo 30 productos ordenados por relevancia e incluye el stock total acumulado.
     */
    @Transactional(readOnly = true)
    public List<ProductoResponseDTO> buscarParaPOS(String q) {
        if (q == null || q.trim().isEmpty()) {
            return List.of();
        }
        String cleanQuery = q.trim();
        Pageable pageable = PageRequest.of(0, 30);

        List<Producto> productos = productoRepository.buscarParaPOS(cleanQuery, pageable);

        return productos.stream().map(p -> {
            ProductoResponseDTO dto = productoMapper.toDto(p);
            int stock = existenciaRepository.findByProducto_IdProducto(p.getIdProducto())
                    .stream()
                    .mapToInt(e -> e.getCantidadActual() != null ? e.getCantidadActual() : 0)
                    .sum();
            dto.setStockTotal(stock);
            return dto;
        }).toList();
    }


    @Transactional
    public ProductoResponseDTO crear(ProductoRequestDTO dto) {
        Categoria categoria = obtenerCategoriaActiva(dto.getIdCategoria());
        Marca marca = obtenerMarcaActiva(dto.getIdMarca());
        Producto producto = productoMapper.toEntity(dto, categoria, marca);

        // Calcular precios automáticos desde costo + margen de categoría
        calcularPreciosDesdeMargen(producto, categoria);

        // Copiar campos POS del DTO
        if (dto.getTasaItbis() != null) {
            producto.setTasaItbis(dto.getTasaItbis());
        }
        if (dto.getCantidadMinimaMayor() != null) {
            producto.setCantidadMinimaMayor(dto.getCantidadMinimaMayor());
        }

        // Primer guardado: obtiene el ID generado y permite construir el SKU interno
        Producto guardado = productoRepository.save(producto);
        guardado.setSku(String.format("PRD-%06d", guardado.getIdProducto()));
        return productoMapper.toDto(productoRepository.save(guardado));
    }

    @Transactional
    public ProductoResponseDTO actualizar(Long id, ProductoRequestDTO dto) {
        Producto producto = obtenerPorId(id);
        Categoria categoria = obtenerCategoriaActiva(dto.getIdCategoria());
        Marca marca = obtenerMarcaActiva(dto.getIdMarca());

        producto.setCodigoBarras(dto.getCodigoBarras());
        producto.setNombre(dto.getNombre());
        producto.setDescripcion(dto.getDescripcion());
        producto.setPrecioVenta(dto.getPrecioVenta());
        producto.setCosto(dto.getCosto());
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        if (dto.getEstado() != null) {
            producto.setEstado(dto.getEstado());
        }
        if (dto.getTasaItbis() != null) {
            producto.setTasaItbis(dto.getTasaItbis());
        }
        if (dto.getCantidadMinimaMayor() != null) {
            producto.setCantidadMinimaMayor(dto.getCantidadMinimaMayor());
        }

        // Recalcular precios desde costo + margen de categoría
        calcularPreciosDesdeMargen(producto, categoria);

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
                .filter(c -> ACTIVO.equals(c.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Categoría no encontrada o inactiva con id: " + idCategoria));
    }

    private Marca obtenerMarcaActiva(Long idMarca) {
        return marcaRepository.findById(idMarca)
                .filter(m -> ACTIVO.equals(m.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException("Marca no encontrada o inactiva con id: " + idMarca));
    }

    /**
     * Calcula automáticamente precioVenta y precioVentaMayor
     * desde el costo del producto y los márgenes de la categoría.
     * <p>
     * Fórmula: precioVenta = costo × (1 + porcentajeMargen / 100)
     */
    private void calcularPreciosDesdeMargen(Producto producto, Categoria categoria) {
        BigDecimal costo = producto.getCosto();
        if (costo == null || costo.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        // Precio al detalle
        if (categoria.getPorcentajeMargen() != null && categoria.getPorcentajeMargen().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal factorDetalle = BigDecimal.ONE.add(categoria.getPorcentajeMargen().divide(CIEN, 4, RoundingMode.HALF_UP));
            producto.setPrecioVenta(costo.multiply(factorDetalle).setScale(2, RoundingMode.HALF_UP));
        }

        // Precio al por mayor
        if (categoria.getPorcentajeMargenMayor() != null && categoria.getPorcentajeMargenMayor().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal factorMayor = BigDecimal.ONE.add(categoria.getPorcentajeMargenMayor().divide(CIEN, 4, RoundingMode.HALF_UP));
            producto.setPrecioVentaMayor(costo.multiply(factorMayor).setScale(2, RoundingMode.HALF_UP));
        }
    }
}
