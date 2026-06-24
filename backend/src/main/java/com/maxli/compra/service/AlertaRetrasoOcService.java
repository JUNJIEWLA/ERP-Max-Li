package com.maxli.compra.service;

import com.maxli.compra.dto.AlertaRetrasoOcResponseDTO;
import com.maxli.compra.entity.AlertaRetrasoOc;
import com.maxli.compra.entity.OrdenCompra;
import com.maxli.compra.repository.AlertaRetrasoOcRepository;
import com.maxli.compra.repository.OrdenCompraRepository;
import com.maxli.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Servicio de alertas de retraso en órdenes de compra.
 *
 * El scheduler detecta diariamente las OC con fecha acordada vencida y aplica
 * lógica de UPSERT: actualiza días de retraso si ya existe una alerta, o crea
 * una nueva si no existe. Esto garantiza que el usuario vea siempre la misma
 * alerta en el buzón con los días actualizados, sin duplicados.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AlertaRetrasoOcService {

    private static final String PENDIENTE = "PENDIENTE";
    private static final String LEIDA     = "LEIDA";

    private final AlertaRetrasoOcRepository alertaRepository;
    private final OrdenCompraRepository     ordenCompraRepository;

    // ── Scheduler ────────────────────────────────────────────────────────────

    /**
     * Ejecuta todos los días a las 8:00 AM.
     * Para cada OC activa con fecha vencida: upsert de la alerta con días actualizados.
     */
    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void generarOActualizarAlertas() {
        log.info("[AlertaRetrasoOc] Ejecutando scheduler de alertas de retraso...");

        List<Long> idsConRetraso = alertaRepository.findIdsOrdenConRetraso();
        int insertadas = 0, actualizadas = 0;

        for (Long idOrden : idsConRetraso) {
            OrdenCompra orden = ordenCompraRepository.findById(idOrden).orElse(null);
            if (orden == null || orden.getFechaLlegadaAcordada() == null) continue;

            int dias = (int) ChronoUnit.DAYS.between(orden.getFechaLlegadaAcordada(), LocalDate.now());

            var alertaOpt = alertaRepository.findByOrdenCompra_IdOrdenCompra(idOrden);
            if (alertaOpt.isPresent()) {
                // UPSERT: actualizar días de retraso en la alerta existente
                AlertaRetrasoOc alerta = alertaOpt.get();
                alerta.setDiasRetraso(dias);
                // Si el usuario la había marcado como LEIDA, la reactivamos con los días actualizados
                // ya que la situación empeoró
                if (LEIDA.equals(alerta.getEstado())) {
                    alerta.setEstado(PENDIENTE);
                }
                alertaRepository.save(alerta);
                actualizadas++;
            } else {
                // INSERT: primera vez que se detecta el retraso para esta OC
                AlertaRetrasoOc nueva = new AlertaRetrasoOc();
                nueva.setOrdenCompra(orden);
                nueva.setDiasRetraso(dias);
                nueva.setEstado(PENDIENTE);
                alertaRepository.save(nueva);
                insertadas++;
            }
        }

        log.info("[AlertaRetrasoOc] Completado: {} nuevas, {} actualizadas.", insertadas, actualizadas);
    }

    // ── Consultas ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AlertaRetrasoOcResponseDTO> listarPendientes(Pageable pageable) {
        return alertaRepository
                .findByEstadoOrderByDiasRetrasoDesc(PENDIENTE, pageable)
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public long contarPendientes() {
        return alertaRepository.countByEstado(PENDIENTE);
    }

    // ── Mutaciones ────────────────────────────────────────────────────────────

    /**
     * Marca una lista de alertas como LEIDA. Retorna void (HTTP 204).
     * Solo actualiza alertas que efectivamente existen y pertenecen a la lista.
     */
    @Transactional
    public void marcarLeidasMasivo(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        List<AlertaRetrasoOc> alertas = alertaRepository.findByIdAlertaRetrasoIn(ids);
        alertas.forEach(a -> a.setEstado(LEIDA));
        alertaRepository.saveAll(alertas);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private AlertaRetrasoOcResponseDTO toDto(AlertaRetrasoOc alerta) {
        AlertaRetrasoOcResponseDTO dto = new AlertaRetrasoOcResponseDTO();
        dto.setIdAlertaRetraso(alerta.getIdAlertaRetraso());
        dto.setIdOrdenCompra(alerta.getOrdenCompra().getIdOrdenCompra());
        dto.setNombreProveedor(alerta.getOrdenCompra().getProveedor().getNombreEmpresa());
        dto.setFechaLlegadaAcordada(alerta.getOrdenCompra().getFechaLlegadaAcordada());
        dto.setDiasRetraso(alerta.getDiasRetraso());
        dto.setEstado(alerta.getEstado());
        dto.setFechaCreacion(alerta.getFechaCreacion());
        dto.setFechaModificacion(alerta.getFechaModificacion());
        return dto;
    }
}
