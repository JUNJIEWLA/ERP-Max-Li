package com.maxli.oferta.mapper;

import com.maxli.oferta.dto.OfertaRequestDTO;
import com.maxli.oferta.dto.OfertaResponseDTO;
import com.maxli.oferta.entity.Oferta;
import com.maxli.oferta.entity.OfertaCantidad;
import com.maxli.oferta.entity.OfertaDescuento;
import com.maxli.producto.entity.Producto;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class OfertaMapper {

    public Oferta toEntity(OfertaRequestDTO dto, Producto producto) {
        Oferta oferta = new Oferta();
        copyBaseFields(dto, producto, oferta);
        applyDetail(dto, oferta);
        return oferta;
    }

    public void updateEntity(Oferta oferta, OfertaRequestDTO dto, Producto producto) {
        copyBaseFields(dto, producto, oferta);
        updateDetail(dto, oferta);
    }

    public OfertaResponseDTO toDto(Oferta oferta) {
        OfertaResponseDTO dto = new OfertaResponseDTO();
        dto.setIdOferta(oferta.getIdOferta());
        dto.setNombre(oferta.getNombre());
        dto.setDescripcion(oferta.getDescripcion());
        dto.setTipo(oferta.getTipo());
        dto.setIdProducto(oferta.getProducto().getIdProducto());
        dto.setProductoSku(oferta.getProducto().getSku());
        dto.setProductoNombre(oferta.getProducto().getNombre());
        dto.setFechaInicio(oferta.getFechaInicio());
        dto.setFechaFin(oferta.getFechaFin());
        dto.setEstado(oferta.getEstado());
        dto.setFechaCreacion(oferta.getFechaCreacion());
        dto.setFechaModificacion(oferta.getFechaModificacion());
        dto.setVigente(esVigente(oferta, LocalDate.now()));

        if (oferta.getOfertaCantidad() != null) {
            dto.setCantidadRequerida(oferta.getOfertaCantidad().getCantidadRequerida());
            dto.setCantidadPagada(oferta.getOfertaCantidad().getCantidadPagada());
        }
        if (oferta.getOfertaDescuento() != null) {
            dto.setPorcentajeDescuento(oferta.getOfertaDescuento().getPorcentajeDescuento());
        }

        return dto;
    }

    private void copyBaseFields(OfertaRequestDTO dto, Producto producto, Oferta oferta) {
        oferta.setNombre(dto.getNombre().trim());
        oferta.setDescripcion(dto.getDescripcion());
        oferta.setTipo(dto.getTipo());
        oferta.setProducto(producto);
        oferta.setFechaInicio(dto.getFechaInicio());
        oferta.setFechaFin(dto.getFechaFin());
        oferta.setEstado(dto.getEstado() != null ? dto.getEstado() : "ACTIVO");
    }

    private void applyDetail(OfertaRequestDTO dto, Oferta oferta) {
        if ("CANTIDAD".equals(dto.getTipo())) {
            OfertaCantidad cantidad = new OfertaCantidad();
            cantidad.setCantidadRequerida(dto.getCantidadRequerida());
            cantidad.setCantidadPagada(dto.getCantidadPagada());
            oferta.setOfertaCantidad(cantidad);
            return;
        }

        OfertaDescuento descuento = new OfertaDescuento();
        descuento.setPorcentajeDescuento(dto.getPorcentajeDescuento());
        oferta.setOfertaDescuento(descuento);
    }

    private void updateDetail(OfertaRequestDTO dto, Oferta oferta) {
        if ("CANTIDAD".equals(dto.getTipo())) {
            oferta.setOfertaDescuento(null);
            OfertaCantidad cantidad = oferta.getOfertaCantidad();
            if (cantidad == null) {
                cantidad = new OfertaCantidad();
            }
            cantidad.setCantidadRequerida(dto.getCantidadRequerida());
            cantidad.setCantidadPagada(dto.getCantidadPagada());
            oferta.setOfertaCantidad(cantidad);
            return;
        }

        oferta.setOfertaCantidad(null);
        OfertaDescuento descuento = oferta.getOfertaDescuento();
        if (descuento == null) {
            descuento = new OfertaDescuento();
        }
        descuento.setPorcentajeDescuento(dto.getPorcentajeDescuento());
        oferta.setOfertaDescuento(descuento);
    }

    private boolean esVigente(Oferta oferta, LocalDate fecha) {
        boolean inicioOk = !oferta.getFechaInicio().isAfter(fecha);
        boolean finOk = oferta.getFechaFin() == null || !oferta.getFechaFin().isBefore(fecha);
        return "ACTIVO".equals(oferta.getEstado()) && inicioOk && finOk;
    }
}
