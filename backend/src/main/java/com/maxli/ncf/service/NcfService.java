package com.maxli.ncf.service;

import com.maxli.exception.ResourceNotFoundException;
import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.dto.ResolucionNcfRequestDTO;
import com.maxli.ncf.dto.ResolucionNcfResponseDTO;
import com.maxli.ncf.entity.ResolucionNcf;
import com.maxli.ncf.repository.ResolucionNcfRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NcfService {

    private static final String ACTIVO = "ACTIVO";
    private static final String INACTIVO = "INACTIVO";
    private static final String VENCIDO = "VENCIDO";
    private static final String AGOTADO = "AGOTADO";
    private static final String UX_ACTIVA_POR_TIPO = "ux_resolucion_ncf_activa_por_tipo";
    private static final String CHK_ESTADO = "chk_resolucion_ncf_estado";
    private static final String CHK_TIPO_PREFIJO = "chk_resolucion_ncf_tipo_prefijo";
    private static final String CHK_RANGO = "chk_resolucion_ncf_rango";
    private static final Set<String> TIPOS_VALIDOS = Set.of("B01", "B02", "B14", "B15");

    private final ResolucionNcfRepository resolucionNcfRepository;

    @Transactional(readOnly = true)
    public List<ResolucionNcfResponseDTO> obtenerTodasResoluciones() {
        return resolucionNcfRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ResolucionNcfResponseDTO crearResolucion(ResolucionNcfRequestDTO requestDTO) {
        normalizar(requestDTO);
        validarNuevaResolucion(requestDTO);

        if (resolucionNcfRepository.existsByTipoNcfAndEstado(requestDTO.getTipoNcf(), ACTIVO)) {
            throw new DuplicateResourceException(
                    "Ya existe una resolución activa para el tipo NCF: " + requestDTO.getTipoNcf());
        }

        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(requestDTO.getTipoNcf());
        resolucion.setDescripcion(requestDTO.getDescripcion());
        resolucion.setNumeroResolucion(requestDTO.getNumeroResolucion());
        resolucion.setPrefijo(requestDTO.getPrefijo());
        resolucion.setSecuenciaInicio(requestDTO.getSecuenciaInicio());
        resolucion.setSecuenciaFinal(requestDTO.getSecuenciaFinal());
        resolucion.setSecuenciaActual(requestDTO.getSecuenciaInicio());
        resolucion.setFechaVencimiento(requestDTO.getFechaVencimiento());
        resolucion.setEstado(ACTIVO);

        ResolucionNcf guardada = guardarTraduciendoIntegridad(resolucion);
        return mapToDTO(guardada);
    }

    @Transactional
    public ResolucionNcfResponseDTO actualizarResolucion(Long id, ResolucionNcfRequestDTO requestDTO) {
        normalizar(requestDTO);
        ResolucionNcf resolucion = buscarParaActualizacion(id);

        if (!resolucion.getTipoNcf().equals(requestDTO.getTipoNcf())) {
            throw new BusinessException("El tipo NCF de una resolución existente no puede cambiarse.");
        }
        if (!resolucion.getPrefijo().equals(requestDTO.getPrefijo())) {
            throw new BusinessException("El prefijo de una resolución existente no puede cambiarse.");
        }
        validarCamposEditables(requestDTO, resolucion);

        resolucion.setDescripcion(requestDTO.getDescripcion());
        resolucion.setNumeroResolucion(requestDTO.getNumeroResolucion());
        resolucion.setSecuenciaFinal(requestDTO.getSecuenciaFinal());
        resolucion.setFechaVencimiento(requestDTO.getFechaVencimiento());

        return mapToDTO(guardarTraduciendoIntegridad(resolucion));
    }

    @Transactional
    public ResolucionNcfResponseDTO activarResolucion(Long id) {
        ResolucionNcf resolucion = buscarParaActualizacion(id);

        if (AGOTADO.equals(resolucion.getEstado())) {
            throw new BusinessException("Una resolución agotada no puede reactivarse. Registre una nueva resolución.");
        }
        validarResolucionPersistida(resolucion);
        if (resolucion.getFechaVencimiento().isBefore(LocalDate.now())) {
            throw new BusinessException("No se puede activar una resolución vencida.");
        }
        if (resolucionNcfRepository.findByTipoNcf(resolucion.getTipoNcf()).stream()
                .anyMatch(r -> !r.getIdResolucion().equals(id) && ACTIVO.equals(r.getEstado()))) {
            throw new DuplicateResourceException(
                    "Ya existe una resolución activa para el tipo NCF: " + resolucion.getTipoNcf());
        }

        resolucion.setEstado(ACTIVO);
        return mapToDTO(guardarTraduciendoIntegridad(resolucion));
    }

    @Transactional
    public ResolucionNcfResponseDTO desactivarResolucion(Long id) {
        ResolucionNcf resolucion = buscarParaActualizacion(id);
        if (AGOTADO.equals(resolucion.getEstado())) {
            throw new BusinessException("Una resolución agotada no puede desactivarse manualmente.");
        }
        resolucion.setEstado(INACTIVO);
        return mapToDTO(guardarTraduciendoIntegridad(resolucion));
    }

    /**
     * Método crítico para generar el siguiente NCF de un tipo específico.
     * Utiliza Pessimistic Locking para evitar saltos y duplicados.
     */
    @Transactional
    public NcfGeneradoDTO generarSiguienteNcf(String tipoNcf) {
        String tipoNormalizado = normalizarTipo(tipoNcf);
        ResolucionNcf resolucion = obtenerActivaBloqueada(tipoNormalizado);

        if (resolucion.getFechaVencimiento().isBefore(LocalDate.now())) {
            throw new BusinessException("La resolución activa para " + tipoNormalizado + " está vencida.");
        }

        Long secuenciaActual = resolucion.getSecuenciaActual();
        
        if (secuenciaActual > resolucion.getSecuenciaFinal()) {
            resolucion.setEstado(AGOTADO);
            guardarTraduciendoIntegridad(resolucion);
            throw new BusinessException("La resolución para el tipo NCF " + tipoNormalizado + " está agotada.");
        }

        // Generar NCF (formato 11 caracteres: 3 prefijo + 8 números)
        // Ejemplo: B01 + 00000001 = B0100000001
        String ncfCompleto = String.format("%s%08d", resolucion.getPrefijo(), secuenciaActual);

        if (secuenciaActual.equals(resolucion.getSecuenciaFinal())) {
            resolucion.setEstado(AGOTADO);
        } else {
            resolucion.setSecuenciaActual(secuenciaActual + 1);
        }
        
        guardarTraduciendoIntegridad(resolucion);

        return new NcfGeneradoDTO(ncfCompleto, resolucion.getIdResolucion(), resolucion.getFechaVencimiento());
    }

    /**
     * Previsualiza el próximo NCF sin consumirlo ni bloquearlo.
     * Solo lectura, usado para mostrar en el encabezado del POS.
     */
    @Transactional(readOnly = true)
    public NcfGeneradoDTO previsualizarSiguienteNcf(String tipoNcf) {
        String tipoNormalizado = normalizarTipo(tipoNcf);
        List<ResolucionNcf> activas = resolucionNcfRepository.findByTipoNcf(tipoNormalizado).stream()
                .filter(r -> ACTIVO.equals(r.getEstado()))
                .sorted(Comparator.comparing(ResolucionNcf::getIdResolucion))
                .toList();

        if (activas.size() > 1) {
            return new NcfGeneradoDTO("Configuración NCF duplicada", null, null);
        }
        ResolucionNcf resolucion = activas.isEmpty() ? null : activas.get(0);

        if (resolucion == null) {
            return new NcfGeneradoDTO("Sin resolución activa", null, null);
        }

        if (resolucion.getFechaVencimiento().isBefore(LocalDate.now())) {
            return new NcfGeneradoDTO("Resolución vencida", null, null);
        }

        if (resolucion.getSecuenciaActual() > resolucion.getSecuenciaFinal()) {
            return new NcfGeneradoDTO("Resolución agotada", null, null);
        }

        String ncfCompleto = String.format("%s%08d", resolucion.getPrefijo(), resolucion.getSecuenciaActual());
        return new NcfGeneradoDTO(ncfCompleto, resolucion.getIdResolucion(), resolucion.getFechaVencimiento());
    }

    private ResolucionNcfResponseDTO mapToDTO(ResolucionNcf resolucion) {
        ResolucionNcfResponseDTO dto = new ResolucionNcfResponseDTO();
        dto.setIdResolucion(resolucion.getIdResolucion());
        dto.setTipoNcf(resolucion.getTipoNcf());
        dto.setDescripcion(resolucion.getDescripcion());
        dto.setNumeroResolucion(resolucion.getNumeroResolucion());
        dto.setPrefijo(resolucion.getPrefijo());
        dto.setSecuenciaInicio(resolucion.getSecuenciaInicio());
        dto.setSecuenciaFinal(resolucion.getSecuenciaFinal());
        dto.setSecuenciaActual(resolucion.getSecuenciaActual());
        dto.setFechaVencimiento(resolucion.getFechaVencimiento());
        dto.setEstado(resolucion.getEstado());
        dto.setFechaCreacion(resolucion.getFechaCreacion());
        return dto;
    }

    private ResolucionNcf obtenerActivaBloqueada(String tipoNcf) {
        List<ResolucionNcf> activas = resolucionNcfRepository.findActivasByTipoParaActualizacion(tipoNcf);
        if (activas.size() > 1) {
            throw new DuplicateResourceException(
                    "Existe más de una resolución activa para el tipo NCF: " + tipoNcf);
        }
        if (!activas.isEmpty()) {
            return activas.get(0);
        }

        List<ResolucionNcf> resoluciones = resolucionNcfRepository.findByTipoNcf(tipoNcf);
        if (resoluciones.isEmpty()) {
            throw new ResourceNotFoundException("No existe resolución NCF para el tipo: " + tipoNcf);
        }
        if (resoluciones.stream().anyMatch(r -> AGOTADO.equals(r.getEstado()))) {
            throw new BusinessException("La resolución para el tipo NCF " + tipoNcf + " está agotada.");
        }
        if (resoluciones.stream().anyMatch(r -> VENCIDO.equals(r.getEstado())
                || (ACTIVO.equals(r.getEstado()) && r.getFechaVencimiento().isBefore(LocalDate.now())))) {
            throw new BusinessException("La resolución para el tipo NCF " + tipoNcf + " está vencida.");
        }
        if (resoluciones.stream().allMatch(r -> INACTIVO.equals(r.getEstado()))) {
            throw new BusinessException("La resolución para el tipo NCF " + tipoNcf + " está inactiva.");
        }
        throw new BusinessException("No hay resolución activa disponible para el tipo NCF: " + tipoNcf);
    }

    private ResolucionNcf buscarParaActualizacion(Long id) {
        return resolucionNcfRepository.findByIdParaActualizacion(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resolución NCF no encontrada con id: " + id));
    }

    private void normalizar(ResolucionNcfRequestDTO requestDTO) {
        if (requestDTO.getTipoNcf() != null) {
            requestDTO.setTipoNcf(requestDTO.getTipoNcf().trim().toUpperCase());
        }
        if (requestDTO.getPrefijo() != null) {
            requestDTO.setPrefijo(requestDTO.getPrefijo().trim().toUpperCase());
        }
        if (requestDTO.getDescripcion() != null) {
            requestDTO.setDescripcion(requestDTO.getDescripcion().trim());
        }
        if (requestDTO.getNumeroResolucion() != null) {
            requestDTO.setNumeroResolucion(requestDTO.getNumeroResolucion().trim());
        }
    }

    private String normalizarTipo(String tipoNcf) {
        if (tipoNcf == null || tipoNcf.isBlank()) {
            throw new BusinessException("El tipo NCF es requerido.");
        }
        String tipoNormalizado = tipoNcf.trim().toUpperCase();
        if (!TIPOS_VALIDOS.contains(tipoNormalizado)) {
            throw new BusinessException("El tipo NCF es inválido. Valores permitidos: B01, B02, B14, B15.");
        }
        return tipoNormalizado;
    }

    private void validarNuevaResolucion(ResolucionNcfRequestDTO requestDTO) {
        validarTipoPrefijoYRango(requestDTO);
    }

    private void validarCamposEditables(ResolucionNcfRequestDTO requestDTO, ResolucionNcf resolucion) {
        validarTipoPrefijoYRango(requestDTO);
        if (!requestDTO.getSecuenciaInicio().equals(resolucion.getSecuenciaInicio())) {
            throw new BusinessException("La secuencia de inicio de una resolución existente no puede cambiarse.");
        }
        boolean tieneComprobantesEmitidos = resolucion.getSecuenciaActual() > resolucion.getSecuenciaInicio()
                || AGOTADO.equals(resolucion.getEstado());
        if (tieneComprobantesEmitidos
                && !requestDTO.getNumeroResolucion().equals(resolucion.getNumeroResolucion())) {
            throw new BusinessException("El número de resolución no puede cambiarse después de emitir comprobantes.");
        }
        if (tieneComprobantesEmitidos
                && requestDTO.getFechaVencimiento().isBefore(resolucion.getFechaVencimiento())) {
            throw new BusinessException("La fecha de vencimiento no puede acortarse después de emitir comprobantes.");
        }
        if (requestDTO.getSecuenciaFinal() < resolucion.getSecuenciaActual()) {
            throw new BusinessException(
                    "La secuencia final no puede quedar por debajo del próximo NCF ni invalidar comprobantes emitidos.");
        }
    }

    private void validarTipoPrefijoYRango(ResolucionNcfRequestDTO requestDTO) {
        String tipo = normalizarTipo(requestDTO.getTipoNcf());
        if (requestDTO.getDescripcion() == null || requestDTO.getDescripcion().isBlank()) {
            throw new BusinessException("La descripción de la resolución NCF es requerida.");
        }
        if (requestDTO.getNumeroResolucion() == null || requestDTO.getNumeroResolucion().isBlank()) {
            throw new BusinessException("El número de resolución NCF es requerido.");
        }
        if (requestDTO.getPrefijo() == null || requestDTO.getPrefijo().isBlank()) {
            throw new BusinessException("El prefijo NCF es requerido.");
        }
        if (!tipo.equals(requestDTO.getPrefijo())) {
            throw new BusinessException("El prefijo debe coincidir con el tipo NCF.");
        }
        if (requestDTO.getSecuenciaInicio() == null || requestDTO.getSecuenciaFinal() == null) {
            throw new BusinessException("Las secuencias de inicio y final son requeridas.");
        }
        if (requestDTO.getSecuenciaInicio() <= 0 || requestDTO.getSecuenciaFinal() <= 0) {
            throw new BusinessException("Las secuencias y rangos NCF deben ser positivos.");
        }
        if (requestDTO.getSecuenciaInicio() > requestDTO.getSecuenciaFinal()) {
            throw new BusinessException("La secuencia de inicio no puede ser mayor que la secuencia final.");
        }
        if (requestDTO.getFechaVencimiento() == null) {
            throw new BusinessException("La fecha de vencimiento es requerida.");
        }
    }

    private void validarResolucionPersistida(ResolucionNcf resolucion) {
        if (!TIPOS_VALIDOS.contains(resolucion.getTipoNcf()) || !resolucion.getTipoNcf().equals(resolucion.getPrefijo())) {
            throw new BusinessException("La resolución tiene tipo NCF o prefijo inválido.");
        }
        if (resolucion.getSecuenciaInicio() <= 0 || resolucion.getSecuenciaActual() <= 0
                || resolucion.getSecuenciaFinal() <= 0
                || resolucion.getSecuenciaInicio() > resolucion.getSecuenciaActual()
                || resolucion.getSecuenciaActual() > resolucion.getSecuenciaFinal()) {
            throw new BusinessException("La resolución tiene rangos NCF inválidos.");
        }
    }

    private ResolucionNcf guardarTraduciendoIntegridad(ResolucionNcf resolucion) {
        try {
            return resolucionNcfRepository.saveAndFlush(resolucion);
        } catch (DataIntegrityViolationException e) {
            String detalle = detalleIntegridad(e);
            if (detalle.contains(UX_ACTIVA_POR_TIPO)) {
                throw new DuplicateResourceException(
                        "Ya existe una resolución activa para el tipo NCF: " + resolucion.getTipoNcf());
            }
            if (detalle.contains(CHK_RANGO)) {
                throw new BusinessException("La resolución NCF viola la regla de rangos positivos y ordenados.");
            }
            if (detalle.contains(CHK_TIPO_PREFIJO)) {
                throw new BusinessException("La resolución NCF viola la regla de tipo y prefijo permitidos.");
            }
            if (detalle.contains(CHK_ESTADO)) {
                throw new BusinessException("La resolución NCF viola la regla de estados permitidos.");
            }
            throw e;
        }
    }

    private String detalleIntegridad(DataIntegrityViolationException e) {
        Throwable causa = e.getMostSpecificCause();
        return causa == null || causa.getMessage() == null ? "" : causa.getMessage();
    }
}
