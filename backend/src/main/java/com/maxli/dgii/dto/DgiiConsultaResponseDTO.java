package com.maxli.dgii.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DgiiConsultaResponseDTO {
    private boolean error;
    private Integer codigoHttp;
    private String mensaje;
    private String cedulaRnc;
    private String nombreRazonSocial;
    private String nombreComercial;
    private String categoria;
    private String regimenDePagos;
    private String estado;
    private String actividadEconomica;
    private String administracionLocal;
    private String facturadorElectronico;
    private String rncConsultado;
}
