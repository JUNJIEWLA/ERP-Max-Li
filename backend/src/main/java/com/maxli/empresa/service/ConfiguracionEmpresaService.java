package com.maxli.empresa.service;

import com.maxli.empresa.dto.ConfiguracionEmpresaDTO;
import com.maxli.empresa.entity.ConfiguracionEmpresa;
import com.maxli.empresa.repository.ConfiguracionEmpresaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lógica de negocio para la configuración de empresa.
 *
 * <p>La fila singleton (id = 1) siempre existe porque V37 la inserta al
 * migrar. {@code obtener()} la lee y la devuelve; si por algún motivo no
 * existiera (base en blanco sin migrar) crea una vacía en memoria para
 * evitar NullPointerException en el frontend.
 */
@Service
@RequiredArgsConstructor
public class ConfiguracionEmpresaService {

    private static final Long SINGLETON_ID = 1L;

    private final ConfiguracionEmpresaRepository repository;

    /**
     * Devuelve la configuración actual de la empresa.
     * Si la fila singleton aún no existe devuelve un DTO con todos los
     * campos en null (no lanza excepción: el frontend renderiza el formulario vacío).
     */
    @Transactional(readOnly = true)
    public ConfiguracionEmpresaDTO obtener() {
        return repository.findById(SINGLETON_ID)
                .map(this::toDto)
                .orElseGet(ConfiguracionEmpresaDTO::new);
    }

    /**
     * Actualiza (o crea si no existe) la configuración de empresa.
     *
     * @param dto campos enviados desde el frontend (todos opcionales).
     * @return el DTO actualizado con la nueva {@code fechaModificacion}.
     */
    @Transactional
    public ConfiguracionEmpresaDTO actualizar(ConfiguracionEmpresaDTO dto) {
        ConfiguracionEmpresa entidad = repository.findById(SINGLETON_ID)
                .orElseGet(() -> {
                    ConfiguracionEmpresa nueva = new ConfiguracionEmpresa();
                    nueva.setId(SINGLETON_ID);
                    return nueva;
                });

        // Mapear todos los campos del DTO a la entidad
        entidad.setNombreComercial(trimOrNull(dto.getNombreComercial()));
        entidad.setRazonSocial(trimOrNull(dto.getRazonSocial()));
        entidad.setRnc(trimOrNull(dto.getRnc()));
        entidad.setTelefonoPrincipal(trimOrNull(dto.getTelefonoPrincipal()));
        entidad.setTelefonoSecundario(trimOrNull(dto.getTelefonoSecundario()));
        entidad.setEmailComercial(trimOrNull(dto.getEmailComercial()));
        entidad.setEmailFacturacion(trimOrNull(dto.getEmailFacturacion()));
        entidad.setDireccion(trimOrNull(dto.getDireccion()));
        entidad.setCiudad(trimOrNull(dto.getCiudad()));
        entidad.setProvincia(trimOrNull(dto.getProvincia()));
        entidad.setPais(trimOrNull(dto.getPais()));
        entidad.setSitioWeb(trimOrNull(dto.getSitioWeb()));
        entidad.setLogoUrl(trimOrNull(dto.getLogoUrl()));
        entidad.setPoliticaDevolucion(trimOrNull(dto.getPoliticaDevolucion()));

        return toDto(repository.save(entidad));
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private ConfiguracionEmpresaDTO toDto(ConfiguracionEmpresa e) {
        ConfiguracionEmpresaDTO dto = new ConfiguracionEmpresaDTO();
        dto.setNombreComercial(e.getNombreComercial());
        dto.setRazonSocial(e.getRazonSocial());
        dto.setRnc(e.getRnc());
        dto.setTelefonoPrincipal(e.getTelefonoPrincipal());
        dto.setTelefonoSecundario(e.getTelefonoSecundario());
        dto.setEmailComercial(e.getEmailComercial());
        dto.setEmailFacturacion(e.getEmailFacturacion());
        dto.setDireccion(e.getDireccion());
        dto.setCiudad(e.getCiudad());
        dto.setProvincia(e.getProvincia());
        dto.setPais(e.getPais());
        dto.setSitioWeb(e.getSitioWeb());
        dto.setLogoUrl(e.getLogoUrl());
        dto.setPoliticaDevolucion(e.getPoliticaDevolucion());
        dto.setFechaModificacion(e.getFechaModificacion());
        return dto;
    }

    /** Convierte cadena vacía a null para no guardar strings en blanco. */
    private String trimOrNull(String valor) {
        if (valor == null) return null;
        String trimmed = valor.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
