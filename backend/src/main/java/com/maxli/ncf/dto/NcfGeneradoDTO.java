package com.maxli.ncf.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NcfGeneradoDTO {
    private String ncfCompleto; // Ej: "B0100000001"
    private Long idResolucion;
    private LocalDate fechaVencimiento;
}
