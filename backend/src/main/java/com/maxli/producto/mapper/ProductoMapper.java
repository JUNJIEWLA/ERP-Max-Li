package com.maxli.producto.mapper;

import com.maxli.producto.dto.ProductoRequestDTO;
import com.maxli.producto.dto.ProductoResponseDTO;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.entity.Marca;
import com.maxli.producto.entity.Producto;
import org.springframework.stereotype.Component;

@Component
public class ProductoMapper {

    public Producto toEntity(ProductoRequestDTO dto, Categoria categoria, Marca marca) {
        Producto producto = new Producto();
        // SKU se genera automáticamente en el service tras el INSERT
        producto.setCodigoBarras(dto.getCodigoBarras());
        producto.setNombre(dto.getNombre());
        producto.setDescripcion(dto.getDescripcion());
        producto.setPrecioVenta(dto.getPrecioVenta());
        producto.setCosto(dto.getCosto());
        producto.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
        producto.setCategoria(categoria);
        producto.setMarca(marca);
        return producto;
    }

    public ProductoResponseDTO toDto(Producto producto) {
        ProductoResponseDTO dto = new ProductoResponseDTO();
        dto.setIdProducto(producto.getIdProducto());
        dto.setSku(producto.getSku());
        dto.setCodigoBarras(producto.getCodigoBarras());
        dto.setNombre(producto.getNombre());
        dto.setDescripcion(producto.getDescripcion());
        dto.setPrecioVenta(producto.getPrecioVenta());
        dto.setCosto(producto.getCosto());
        dto.setEstado(producto.getEstado());
        dto.setIdCategoria(producto.getCategoria().getIdCategoria());
        dto.setCategoriaNombre(producto.getCategoria().getNombre());
        dto.setIdMarca(producto.getMarca().getIdMarca());
        dto.setMarcaNombre(producto.getMarca().getNombre());
        dto.setFechaCreacion(producto.getFechaCreacion());
        dto.setFechaModificacion(producto.getFechaModificacion());
        return dto;
    }
}
