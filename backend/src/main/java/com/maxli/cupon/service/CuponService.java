package com.maxli.cupon.service;

import com.maxli.cupon.dto.CuponAplicadoDTO;
import com.maxli.cupon.dto.CuponRequestDTO;
import com.maxli.cupon.dto.CuponResponseDTO;
import com.maxli.cupon.entity.Cupon;
import com.maxli.cupon.entity.TipoDescuento;
import com.maxli.cupon.repository.CuponRepository;
import com.maxli.exception.BusinessException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.producto.entity.Categoria;
import com.maxli.producto.repository.CategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CuponService {

    private final CuponRepository cuponRepository;
    private final CategoriaRepository categoriaRepository;

    // ─── CRUD ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<CuponResponseDTO> listar(Pageable pageable) {
        return cuponRepository.findAll(pageable).map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public Page<CuponResponseDTO> listarVigentes(Pageable pageable) {
        return cuponRepository.findVigentes(LocalDate.now(), pageable).map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public CuponResponseDTO buscarPorId(Long id) {
        return mapToDTO(obtenerPorId(id));
    }

    @Transactional
    public CuponResponseDTO crear(CuponRequestDTO dto) {
        validar(dto, null);

        Cupon cupon = new Cupon();
        // Generar código interno correlativo: CUPON-001
        long total = cuponRepository.contarTodos() + 1;
        cupon.setCodigoInterno(String.format("CUPON-%03d", total));
        mapFromDTO(cupon, dto);

        return mapToDTO(cuponRepository.save(cupon));
    }

    @Transactional
    public CuponResponseDTO actualizar(Long id, CuponRequestDTO dto) {
        validar(dto, id);
        Cupon cupon = obtenerPorId(id);
        mapFromDTO(cupon, dto);
        return mapToDTO(cuponRepository.save(cupon));
    }

    @Transactional
    public void desactivar(Long id) {
        Cupon cupon = obtenerPorId(id);
        cupon.setEstado("INACTIVO");
        cuponRepository.save(cupon);
    }

    // ─── Validación para el POS ──────────────────────────────────────────

    /**
     * Valida y aplica el cupón en el Punto de Venta.
     *
     * @param codigoSecreto   Código que el cajero digitó.
     * @param idsCategorias   IDs de las categorías de los productos en el carrito.
     * @param subtotal        Subtotal de la compra (antes del descuento).
     * @return                DTO con el monto a descontar.
     * @throws BusinessException / ResourceNotFoundException en caso de error.
     */
    @Transactional
    public CuponAplicadoDTO validarYAplicarCupon(String codigoSecreto,
                                                  List<Long> idsCategorias,
                                                  BigDecimal subtotal) {
        CuponResuelto resuelto = resolverCupon(codigoSecreto, idsCategorias, subtotal);

        // Registrar uso — solo en la venta real, nunca en un preview.
        resuelto.cupon().setUsosActuales(resuelto.cupon().getUsosActuales() + 1);
        cuponRepository.save(resuelto.cupon());

        return construirAplicadoDTO(resuelto);
    }

    /**
     * Igual que {@link #validarYAplicarCupon}, pero de solo lectura: valida y
     * calcula el descuento sin incrementar {@code usosActuales}. Se usa en el
     * preview de factura, que puede ejecutarse muchas veces mientras el
     * cajero arma el carrito y no debe consumir el límite de usos del cupón.
     */
    @Transactional(readOnly = true)
    public CuponAplicadoDTO previsualizarCupon(String codigoSecreto,
                                                List<Long> idsCategorias,
                                                BigDecimal subtotal) {
        return construirAplicadoDTO(resolverCupon(codigoSecreto, idsCategorias, subtotal));
    }

    private record CuponResuelto(Cupon cupon, BigDecimal montoDescontado) {}

    private CuponResuelto resolverCupon(String codigoSecreto, List<Long> idsCategorias, BigDecimal subtotal) {
        Cupon cupon = cuponRepository.findByCodigoSecretoWithCategorias(codigoSecreto)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cupón no encontrado. Verifica el código ingresado."));

        // 1. Estado
        if (!"ACTIVO".equals(cupon.getEstado())) {
            throw new BusinessException("El cupón '" + codigoSecreto + "' está inactivo.");
        }

        // 2. Vigencia
        LocalDate hoy = LocalDate.now();
        if (hoy.isBefore(cupon.getFechaInicio())) {
            throw new BusinessException("El cupón aún no está vigente. Inicia el " + cupon.getFechaInicio() + ".");
        }
        if (cupon.getFechaFin() != null && hoy.isAfter(cupon.getFechaFin())) {
            throw new BusinessException("El cupón venció el " + cupon.getFechaFin() + ".");
        }

        // 3. Límite de usos
        if (cupon.getUsosActuales() >= cupon.getLimiteUsos()) {
            throw new BusinessException("El cupón ya alcanzó su límite máximo de usos (" + cupon.getLimiteUsos() + ").");
        }

        // 4. Monto mínimo de compra
        if (subtotal.compareTo(cupon.getMontoMinimoCompra()) < 0) {
            throw new BusinessException(
                    String.format("El subtotal RD$ %.2f no alcanza el mínimo requerido de RD$ %.2f.",
                            subtotal, cupon.getMontoMinimoCompra()));
        }

        // 5. Compatibilidad de categorías
        if (!cupon.isAplicaTodasCategorias() && !cupon.getCategorias().isEmpty()) {
            Set<Long> categoriasPermitidas = new HashSet<>();
            cupon.getCategorias().forEach(c -> categoriasPermitidas.add(c.getIdCategoria()));
            boolean hayProductoValido = idsCategorias.stream().anyMatch(categoriasPermitidas::contains);
            if (!hayProductoValido) {
                throw new BusinessException(
                        "Ninguno de los productos en el carrito pertenece a las categorías habilitadas por este cupón.");
            }
        }

        // 6. Calcular monto a descontar
        BigDecimal montoDescontado;
        if (cupon.getTipoDescuento() == TipoDescuento.PORCENTAJE) {
            montoDescontado = subtotal
                    .multiply(cupon.getValorDescuento())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else {
            // MONTO_FIJO: no puede superar el subtotal
            montoDescontado = cupon.getValorDescuento().min(subtotal);
        }

        return new CuponResuelto(cupon, montoDescontado);
    }

    private CuponAplicadoDTO construirAplicadoDTO(CuponResuelto resuelto) {
        Cupon cupon = resuelto.cupon();
        return new CuponAplicadoDTO(
                cupon.getIdCupon(),
                cupon.getCodigoInterno(),
                cupon.getCodigoSecreto(),
                cupon.getTipoDescuento().name(),
                cupon.getValorDescuento(),
                resuelto.montoDescontado()
        );
    }

    // ─── Privados ─────────────────────────────────────────────────────────

    private Cupon obtenerPorId(Long id) {
        return cuponRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cupón no encontrado con id: " + id));
    }

    private void validar(CuponRequestDTO dto, Long idExcluir) {
        // Código secreto único
        boolean duplicado = idExcluir == null
                ? cuponRepository.existsByCodigoSecreto(dto.getCodigoSecreto())
                : cuponRepository.existsByCodigoSecretoAndIdCuponNot(dto.getCodigoSecreto(), idExcluir);
        if (duplicado) {
            throw new BusinessException("El código secreto '" + dto.getCodigoSecreto() + "' ya está en uso.");
        }

        // Fechas
        if (dto.getFechaFin() != null && dto.getFechaFin().isBefore(dto.getFechaInicio())) {
            throw new BusinessException("La fecha fin no puede ser anterior a la fecha inicio.");
        }

        // Porcentaje no puede superar 100%
        if (dto.getTipoDescuento() == TipoDescuento.PORCENTAJE &&
                dto.getValorDescuento().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BusinessException("El porcentaje de descuento no puede superar el 100%.");
        }

        // Categorías requeridas si no aplica a todas
        if (!dto.isAplicaTodasCategorias() &&
                (dto.getCategoriaIds() == null || dto.getCategoriaIds().isEmpty())) {
            throw new BusinessException("Debes seleccionar al menos una categoría cuando el cupón no aplica a todas.");
        }
    }

    private void mapFromDTO(Cupon cupon, CuponRequestDTO dto) {
        cupon.setCodigoSecreto(dto.getCodigoSecreto().toUpperCase());
        cupon.setTipoDescuento(dto.getTipoDescuento());
        cupon.setValorDescuento(dto.getValorDescuento());
        cupon.setAplicaTodasCategorias(dto.isAplicaTodasCategorias());
        cupon.setMontoMinimoCompra(dto.getMontoMinimoCompra());
        cupon.setFechaInicio(dto.getFechaInicio());
        cupon.setFechaFin(dto.getFechaFin());
        cupon.setLimiteUsos(dto.getLimiteUsos());
        cupon.setEstado(dto.getEstado());

        // Categorías
        cupon.getCategorias().clear();
        if (!dto.isAplicaTodasCategorias() && dto.getCategoriaIds() != null) {
            List<Categoria> categorias = categoriaRepository.findAllById(dto.getCategoriaIds());
            cupon.getCategorias().addAll(categorias);
        }
    }

    private CuponResponseDTO mapToDTO(Cupon c) {
        CuponResponseDTO dto = new CuponResponseDTO();
        dto.setIdCupon(c.getIdCupon());
        dto.setCodigoInterno(c.getCodigoInterno());
        dto.setCodigoSecreto(c.getCodigoSecreto());
        dto.setTipoDescuento(c.getTipoDescuento());
        dto.setValorDescuento(c.getValorDescuento());
        dto.setAplicaTodasCategorias(c.isAplicaTodasCategorias());
        dto.setMontoMinimoCompra(c.getMontoMinimoCompra());
        dto.setFechaInicio(c.getFechaInicio());
        dto.setFechaFin(c.getFechaFin());
        dto.setLimiteUsos(c.getLimiteUsos());
        dto.setUsosActuales(c.getUsosActuales());
        dto.setEstado(c.getEstado());
        dto.setFechaCreacion(c.getFechaCreacion());
        dto.setFechaModificacion(c.getFechaModificacion());
        dto.setCategorias(c.getCategorias().stream()
                .map(cat -> {
                    CuponResponseDTO.CategoriaSimpleDTO s = new CuponResponseDTO.CategoriaSimpleDTO();
                    s.setIdCategoria(cat.getIdCategoria());
                    s.setNombre(cat.getNombre());
                    return s;
                }).toList());
        return dto;
    }
}
