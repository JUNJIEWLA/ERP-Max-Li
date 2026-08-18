package com.maxli.dgii.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.maxli.dgii.dto.DgiiConsultaResponseDTO;
import com.maxli.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@Slf4j
@RequiredArgsConstructor
public class DgiiConsultaService {

    private static final String API_URL = "https://rnc.megaplus.com.do/api/consulta?rnc=";
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public DgiiConsultaResponseDTO consultarRnc(String rnc) {
        if (rnc == null || rnc.isBlank()) {
            throw new BusinessException("Debe ingresar un RNC o Cédula válido para la consulta.");
        }

        String cleanRnc = rnc.replaceAll("[^0-9]", "").trim();
        if (cleanRnc.length() != 9 && cleanRnc.length() != 11) {
            throw new BusinessException("El RNC/Cédula debe tener 9 dígitos (RNC Sociedad) u 11 dígitos (Cédula/RNC Persona).");
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL + cleanRnc))
                    .timeout(Duration.ofSeconds(6))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                DgiiRawResponse raw = objectMapper.readValue(response.body(), DgiiRawResponse.class);
                return DgiiConsultaResponseDTO.builder()
                        .error(raw.isError())
                        .codigoHttp(raw.getCodigoHttp() != null ? raw.getCodigoHttp() : 200)
                        .mensaje(raw.getMensaje())
                        .cedulaRnc(raw.getCedulaRnc())
                        .nombreRazonSocial(raw.getNombreRazonSocial())
                        .nombreComercial(raw.getNombreComercial())
                        .categoria(raw.getCategoria())
                        .regimenDePagos(raw.getRegimenDePagos())
                        .estado(raw.getEstado())
                        .actividadEconomica(raw.getActividadEconomica())
                        .administracionLocal(raw.getAdministracionLocal())
                        .facturadorElectronico(raw.getFacturadorElectronico())
                        .rncConsultado(raw.getRncConsultado())
                        .build();
            } else if (response.statusCode() == 404) {
                return DgiiConsultaResponseDTO.builder()
                        .error(true)
                        .codigoHttp(404)
                        .mensaje("El RNC/Cédula '" + cleanRnc + "' no se encuentra inscrito como contribuyente en la DGII.")
                        .rncConsultado(cleanRnc)
                        .build();
            } else {
                return DgiiConsultaResponseDTO.builder()
                        .error(true)
                        .codigoHttp(response.statusCode())
                        .mensaje("Error al consultar la DGII (código " + response.statusCode() + ").")
                        .rncConsultado(cleanRnc)
                        .build();
            }
        } catch (Exception e) {
            log.error("Error al consultar RNC DGII: {}", e.getMessage(), e);
            throw new BusinessException("No se pudo conectar con el servicio de consulta DGII: " + e.getMessage());
        }
    }

    @lombok.Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class DgiiRawResponse {
        private boolean error;
        @JsonProperty("codigo_http")
        private Integer codigoHttp;
        private String mensaje;
        @JsonProperty("cedula_rnc")
        private String cedulaRnc;
        @JsonProperty("nombre_razon_social")
        private String nombreRazonSocial;
        @JsonProperty("nombre_comercial")
        private String nombreComercial;
        private String categoria;
        @JsonProperty("regimen_de_pagos")
        private String regimenDePagos;
        private String estado;
        @JsonProperty("actividad_economica")
        private String actividadEconomica;
        @JsonProperty("administracion_local")
        private String administracionLocal;
        @JsonProperty("facturador_electronico")
        private String facturadorElectronico;
        @JsonProperty("rnc_consultado")
        private String rncConsultado;
    }
}
