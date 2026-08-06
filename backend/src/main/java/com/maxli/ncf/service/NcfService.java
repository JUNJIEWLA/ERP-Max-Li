package com.maxli.ncf.service;

import com.maxli.exception.ResourceNotFoundException;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.dto.ResolucionNcfRequestDTO;
import com.maxli.ncf.dto.ResolucionNcfResponseDTO;
import com.maxli.ncf.entity.ResolucionNcf;
import com.maxli.ncf.repository.ResolucionNcfRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NcfService {

    private final ResolucionNcfRepository resolucionNcfRepository;

    @Transactional(readOnly = true)
    public List<ResolucionNcfResponseDTO> obtenerTodasResoluciones() {
        return resolucionNcfRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ResolucionNcfResponseDTO crearResolucion(ResolucionNcfRequestDTO requestDTO) {
        // Podríamos desactivar resoluciones anteriores del mismo tipo si es necesario
        // Pero típicamente se agota una y entra la otra, o se maneja el estado manualmente.
        
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(requestDTO.getTipoNcf());
        resolucion.setDescripcion(requestDTO.getDescripcion());
        resolucion.setNumeroResolucion(requestDTO.getNumeroResolucion());
        resolucion.setPrefijo(requestDTO.getPrefijo());
        resolucion.setSecuenciaInicio(requestDTO.getSecuenciaInicio());
        resolucion.setSecuenciaFinal(requestDTO.getSecuenciaFinal());
        resolucion.setSecuenciaActual(requestDTO.getSecuenciaInicio());
        resolucion.setFechaVencimiento(requestDTO.getFechaVencimiento());
        resolucion.setEstado("ACTIVO");

        ResolucionNcf guardada = resolucionNcfRepository.save(resolucion);
        return mapToDTO(guardada);
    }

    @Transactional
    public ResolucionNcfResponseDTO actualizarResolucion(Long id, ResolucionNcfRequestDTO requestDTO) {
        ResolucionNcf resolucion = resolucionNcfRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resolución NCF no encontrada con id: " + id));

        resolucion.setDescripcion(requestDTO.getDescripcion());
        resolucion.setNumeroResolucion(requestDTO.getNumeroResolucion());
        resolucion.setSecuenciaFinal(requestDTO.getSecuenciaFinal());
        resolucion.setFechaVencimiento(requestDTO.getFechaVencimiento());

        // Si se amplía la secuencia final y estaba AGOTADO, se reactiva
        if ("AGOTADO".equals(resolucion.getEstado()) &&
                requestDTO.getSecuenciaFinal() >= resolucion.getSecuenciaActual()) {
            resolucion.setEstado("ACTIVO");
        }
        // Si la fecha de vencimiento ya pasó, marcar como VENCIDO
        if (requestDTO.getFechaVencimiento().isBefore(LocalDate.now())) {
            resolucion.setEstado("VENCIDO");
        }

        return mapToDTO(resolucionNcfRepository.save(resolucion));
    }

    /**
     * Método crítico para generar el siguiente NCF de un tipo específico.
     * Utiliza Pessimistic Locking para evitar saltos y duplicados.
     */
    @Transactional
    public NcfGeneradoDTO generarSiguienteNcf(String tipoNcf) {
        ResolucionNcf resolucion = resolucionNcfRepository.findActivaByTipoParaActualizacion(tipoNcf)
                .orElseThrow(() -> new ResourceNotFoundException("No hay resolución activa para el tipo de NCF: " + tipoNcf));

        if (resolucion.getFechaVencimiento().isBefore(LocalDate.now())) {
            resolucion.setEstado("VENCIDO");
            resolucionNcfRepository.save(resolucion);
            throw new IllegalStateException("La resolución activa para " + tipoNcf + " ha vencido.");
        }

        Long secuenciaActual = resolucion.getSecuenciaActual();
        
        if (secuenciaActual > resolucion.getSecuenciaFinal()) {
            resolucion.setEstado("AGOTADO");
            resolucionNcfRepository.save(resolucion);
            throw new IllegalStateException("Se han agotado los comprobantes para el tipo NCF: " + tipoNcf);
        }

        // Generar NCF (formato 11 caracteres: 3 prefijo + 8 números)
        // Ejemplo: B01 + 00000001 = B0100000001
        String ncfCompleto = String.format("%s%08d", resolucion.getPrefijo(), secuenciaActual);

        // Incrementar secuencia
        resolucion.setSecuenciaActual(secuenciaActual + 1);
        
        // Verificar si se agotó en este momento para cambiar el estado para la próxima vez
        if (resolucion.getSecuenciaActual() > resolucion.getSecuenciaFinal()) {
            resolucion.setEstado("AGOTADO");
        }
        
        resolucionNcfRepository.save(resolucion);

        return new NcfGeneradoDTO(ncfCompleto, resolucion.getIdResolucion(), resolucion.getFechaVencimiento());
    }

    /**
     * Previsualiza el próximo NCF sin consumirlo ni bloquearlo.
     * Solo lectura, usado para mostrar en el encabezado del POS.
     */
    @Transactional(readOnly = true)
    public NcfGeneradoDTO previsualizarSiguienteNcf(String tipoNcf) {
        ResolucionNcf resolucion = resolucionNcfRepository.findAll().stream()
                .filter(r -> r.getTipoNcf().equals(tipoNcf) && "ACTIVO".equals(r.getEstado()))
                .findFirst()
                .orElse(null);

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
}
