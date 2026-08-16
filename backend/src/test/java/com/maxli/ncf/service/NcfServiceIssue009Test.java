package com.maxli.ncf.service;

import com.maxli.exception.BusinessException;
import com.maxli.exception.DuplicateResourceException;
import com.maxli.ncf.dto.NcfGeneradoDTO;
import com.maxli.ncf.dto.ResolucionNcfRequestDTO;
import com.maxli.ncf.entity.ResolucionNcf;
import com.maxli.ncf.repository.ResolucionNcfRepository;
import com.maxli.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ISSUE-009 — Controles de resoluciones y secuencias NCF")
class NcfServiceIssue009Test extends PostgresIntegrationTest {

    @Autowired private NcfService ncfService;
    @Autowired private ResolucionNcfRepository resolucionNcfRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limpiarResoluciones() {
        jdbcTemplate.update("DELETE FROM resolucion_ncf");
    }

    @Test
    @DisplayName("solo puede existir una resolución ACTIVA por tipo")
    void soloPuedeExistirUnaResolucionActivaPorTipo() {
        ncfService.crearResolucion(request("B02", 1, 10));

        assertThatThrownBy(() -> ncfService.crearResolucion(request("B02", 20, 30)))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("activa")
                .hasMessageContaining("B02");
    }

    @Test
    @DisplayName("una ACTIVA y varias INACTIVAS del mismo tipo pueden coexistir")
    void unaActivaYVariasInactivasDelMismoTipoPuedenCoexistir() {
        Long primera = ncfService.crearResolucion(request("B02", 1, 10)).getIdResolucion();
        ncfService.desactivarResolucion(primera);
        Long segunda = ncfService.crearResolucion(request("B02", 11, 20)).getIdResolucion();
        ncfService.desactivarResolucion(segunda);

        ncfService.crearResolucion(request("B02", 21, 30));

        List<ResolucionNcf> resoluciones = resolucionNcfRepository.findByTipoNcf("B02");
        assertThat(resoluciones).filteredOn(r -> "ACTIVO".equals(r.getEstado())).hasSize(1);
        assertThat(resoluciones).filteredOn(r -> "INACTIVO".equals(r.getEstado())).hasSize(2);
    }

    @Test
    @DisplayName("rechaza tipos, prefijos y rangos inválidos antes de persistir")
    void rechazaTiposPrefijosYRangosInvalidos() {
        assertThatThrownBy(() -> ncfService.crearResolucion(request("B99", 1, 10)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("tipo NCF");

        ResolucionNcfRequestDTO prefijoIncoherente = request("B02", 1, 10);
        prefijoIncoherente.setPrefijo("B01");
        assertThatThrownBy(() -> ncfService.crearResolucion(prefijoIncoherente))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("prefijo");

        assertThatThrownBy(() -> ncfService.crearResolucion(request("B14", 0, 10)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("positiv");

        assertThatThrownBy(() -> ncfService.crearResolucion(request("B15", 20, 10)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("secuencia");

        assertThat(resolucionNcfRepository.count()).isZero();
    }

    @Test
    @DisplayName("PostgreSQL rechaza dos ACTIVA del mismo tipo aunque se salte el servicio")
    void postgresRechazaDuplicadosActivosAunqueSeSalteElServicio() {
        resolucionNcfRepository.save(entidad("B02", 1, 10, "ACTIVO", LocalDate.now().plusDays(30)));

        assertThatThrownBy(() -> resolucionNcfRepository.saveAndFlush(
                entidad("B02", 11, 20, "ACTIVO", LocalDate.now().plusDays(30))))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("no genera desde resoluciones vencidas, inactivas ni agotadas")
    void noGeneraDesdeResolucionesNoDisponibles() {
        resolucionNcfRepository.save(entidad("B01", 1, 10, "ACTIVO", LocalDate.now().minusDays(1)));
        assertThatThrownBy(() -> ncfService.generarSiguienteNcf("B01"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("vencida");
        assertThat(resolucionNcfRepository.findByTipoNcf("B01").getFirst().getEstado())
                .as("vencimiento no se marca y revierte en la misma transacción")
                .isEqualTo("ACTIVO");

        Long inactiva = ncfService.crearResolucion(request("B02", 1, 10)).getIdResolucion();
        ncfService.desactivarResolucion(inactiva);
        assertThatThrownBy(() -> ncfService.generarSiguienteNcf("B02"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inactiva");

        ncfService.crearResolucion(request("B14", 1, 1));
        NcfGeneradoDTO ultimo = ncfService.generarSiguienteNcf("B14");
        assertThat(ultimo.getNcfCompleto()).isEqualTo("B1400000001");
        ResolucionNcf agotada = resolucionNcfRepository.findByTipoNcf("B14").getFirst();
        assertThat(agotada.getEstado()).isEqualTo("AGOTADO");
        assertThat(agotada.getSecuenciaActual()).isEqualTo(agotada.getSecuenciaFinal());

        assertThatThrownBy(() -> ncfService.generarSiguienteNcf("B14"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("agotada");
    }

    @Test
    @DisplayName("la generación concurrente produce NCF únicos, secuenciales y sin duplicados")
    void generacionConcurrenteProduceNcfUnicosYSecuenciales() throws Exception {
        Long idResolucion = ncfService.crearResolucion(request("B02", 1, 30)).getIdResolucion();
        CyclicBarrier barrera = new CyclicBarrier(12);
        ExecutorService pool = Executors.newFixedThreadPool(12);

        List<Future<NcfGeneradoDTO>> resultados;
        try {
            List<Callable<NcfGeneradoDTO>> tareas = java.util.stream.IntStream.range(0, 12)
                    .mapToObj(i -> (Callable<NcfGeneradoDTO>) () -> {
                        barrera.await(20, TimeUnit.SECONDS);
                        return ncfService.generarSiguienteNcf("B02");
                    })
                    .toList();
            resultados = pool.invokeAll(tareas);
        } finally {
            pool.shutdown();
            pool.awaitTermination(30, TimeUnit.SECONDS);
        }

        List<String> ncf = resultados.stream().map(future -> {
            try {
                return future.get().getNcfCompleto();
            } catch (Exception e) {
                throw new AssertionError(e);
            }
        }).sorted().toList();

        assertThat(ncf).containsExactly(
                "B0200000001", "B0200000002", "B0200000003", "B0200000004",
                "B0200000005", "B0200000006", "B0200000007", "B0200000008",
                "B0200000009", "B0200000010", "B0200000011", "B0200000012");
        assertThat(secuenciaActual(idResolucion)).isEqualTo(13L);
    }

    private ResolucionNcfRequestDTO request(String tipo, long inicio, long fin) {
        ResolucionNcfRequestDTO dto = new ResolucionNcfRequestDTO();
        dto.setTipoNcf(tipo);
        dto.setDescripcion("Resolucion " + tipo);
        dto.setNumeroResolucion("RES-" + tipo + "-" + inicio);
        dto.setPrefijo(tipo);
        dto.setSecuenciaInicio(inicio);
        dto.setSecuenciaFinal(fin);
        dto.setFechaVencimiento(LocalDate.now().plusDays(30));
        return dto;
    }

    private ResolucionNcf entidad(String tipo, long inicio, long fin, String estado, LocalDate vencimiento) {
        ResolucionNcf resolucion = new ResolucionNcf();
        resolucion.setTipoNcf(tipo);
        resolucion.setDescripcion("Resolucion " + tipo);
        resolucion.setNumeroResolucion("RES-" + tipo + "-" + inicio);
        resolucion.setPrefijo(tipo);
        resolucion.setSecuenciaInicio(inicio);
        resolucion.setSecuenciaFinal(fin);
        resolucion.setSecuenciaActual(inicio);
        resolucion.setFechaVencimiento(vencimiento);
        resolucion.setEstado(estado);
        return resolucion;
    }

    private Long secuenciaActual(Long idResolucion) {
        return jdbcTemplate.queryForObject(
                "SELECT secuencia_actual FROM resolucion_ncf WHERE id_resolucion = ?",
                Long.class, idResolucion);
    }
}
