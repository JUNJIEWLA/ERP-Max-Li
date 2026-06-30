package com.maxli.oferta.service;

import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.oferta.dto.OfertaRequestDTO;
import com.maxli.oferta.dto.OfertaResponseDTO;
import com.maxli.oferta.entity.Oferta;
import com.maxli.oferta.mapper.OfertaMapper;
import com.maxli.oferta.repository.OfertaRepository;
import com.maxli.producto.entity.Producto;
import com.maxli.producto.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OfertaService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";
    private static final String CANTIDAD = "CANTIDAD";
    private static final String DESCUENTO = "DESCUENTO";

    private final OfertaRepository ofertaRepository;
    private final ProductoRepository productoRepository;
    private final OfertaMapper ofertaMapper;

    @Transactional(readOnly = true)
    public Page<OfertaResponseDTO> listar(Pageable pageable) {
        return ofertaRepository.findAll(pageable).map(ofertaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OfertaResponseDTO> listarActivas(Pageable pageable) {
        return ofertaRepository.findByEstado(ACTIVO, pageable).map(ofertaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OfertaResponseDTO> listarVigentes(Pageable pageable) {
        return ofertaRepository.findVigentes(LocalDate.now(), pageable).map(ofertaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OfertaResponseDTO> listarPorTipo(String tipo, Pageable pageable) {
        return ofertaRepository.findByTipo(tipo, pageable).map(ofertaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<OfertaResponseDTO> listarPorProducto(Long idProducto, Pageable pageable) {
        return ofertaRepository.findByProductoIdProducto(idProducto, pageable).map(ofertaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public List<OfertaResponseDTO> listarVigentesPorProducto(Long idProducto) {
        return ofertaRepository.findVigentesPorProducto(idProducto, LocalDate.now())
                .stream()
                .map(ofertaMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public OfertaResponseDTO buscarPorId(Long id) {
        return ofertaMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public OfertaResponseDTO crear(OfertaRequestDTO dto) {
        validar(dto);
        Producto producto = obtenerProductoActivo(dto.getIdProducto());
        Oferta oferta = ofertaMapper.toEntity(dto, producto);
        return ofertaMapper.toDto(ofertaRepository.save(oferta));
    }

    @Transactional
    public OfertaResponseDTO actualizar(Long id, OfertaRequestDTO dto) {
        validar(dto);
        Oferta oferta = obtenerPorId(id);
        Producto producto = obtenerProductoActivo(dto.getIdProducto());
        ofertaMapper.updateEntity(oferta, dto, producto);
        return ofertaMapper.toDto(ofertaRepository.save(oferta));
    }

    @Transactional
    public void desactivar(Long id) {
        Oferta oferta = obtenerPorId(id);
        oferta.setEstado(INACTIVO);
        ofertaRepository.save(oferta);
    }

    private Oferta obtenerPorId(Long id) {
        return ofertaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Oferta no encontrada con id: " + id));
    }

    private Producto obtenerProductoActivo(Long idProducto) {
        return productoRepository.findById(idProducto)
                .filter(p -> ACTIVO.equals(p.getEstado()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado o inactivo con id: " + idProducto));
    }

    private void validar(OfertaRequestDTO dto) {
        if (dto.getFechaFin() != null && dto.getFechaFin().isBefore(dto.getFechaInicio())) {
            throw new BusinessException("La fecha fin no puede ser anterior a la fecha inicio");
        }

        if (CANTIDAD.equals(dto.getTipo())) {
            if (dto.getCantidadRequerida() == null || dto.getCantidadPagada() == null) {
                throw new BusinessException("Las ofertas por cantidad requieren cantidad requerida y cantidad pagada");
            }
            if (dto.getCantidadPagada() >= dto.getCantidadRequerida()) {
                throw new BusinessException("La cantidad pagada debe ser menor que la cantidad requerida");
            }
            return;
        }

        if (DESCUENTO.equals(dto.getTipo())) {
            if (dto.getPorcentajeDescuento() == null) {
                throw new BusinessException("Las ofertas de descuento requieren porcentaje de descuento");
            }
            return;
        }

        throw new BusinessException("Tipo de oferta no soportado: " + dto.getTipo());
    }
}
