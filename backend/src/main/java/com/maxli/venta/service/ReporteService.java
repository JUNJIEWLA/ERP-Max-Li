package com.maxli.venta.service;

import com.maxli.devolucion.dto.TotalesNotasCreditoDTO;
import com.maxli.devolucion.repository.DevolucionRepository;
import com.maxli.venta.dto.ReporteVentasDTO;
import com.maxli.venta.dto.TotalesVentasDTO;
import com.maxli.venta.dto.VentaFiltroDTO;
import com.maxli.venta.dto.VentaResumenDTO;
import com.maxli.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Reporte de ventas de un período.
 * <p>
 * Informa de lo que la tienda vendió <b>de verdad</b>: al bruto facturado le
 * resta las Notas de Crédito B04 que devolvieron parte de esas ventas. Sin esa
 * resta el reporte cobra dos veces lo que se devolvió, y el ITBIS declarado
 * sale más alto de lo que corresponde.
 * <p>
 * Los totales no se acumulan recorriendo las filas listadas sino con dos sumas
 * agregadas en la base, porque el listado se corta en
 * {@value #MAXIMO_FILAS_LISTADAS} filas y un total incompleto es peor que uno
 * ausente.
 */
@Service
@RequiredArgsConstructor
public class ReporteService {

    /**
     * Tope de filas que el reporte detalla. Protege la memoria del servidor
     * ante un rango de años; los totales siguen cubriendo el período entero.
     */
    static final int MAXIMO_FILAS_LISTADAS = 10_000;

    private static final int TAMANO_PAGINA = 500;

    private final VentaService ventaService;
    private final VentaRepository ventaRepository;
    private final DevolucionRepository devolucionRepository;

    @Transactional(readOnly = true)
    public ReporteVentasDTO reporteVentas(VentaFiltroDTO filtro) {
        // Valida el rango y normaliza una sola vez: el listado y las dos sumas
        // tienen que mirar exactamente el mismo conjunto de ventas.
        FiltroVentaNormalizado criterios = FiltroVentaNormalizado.de(filtro);

        List<VentaResumenDTO> ventas = listarVentas(filtro);

        TotalesVentasDTO brutos = ventaRepository.sumarTotales(
                criterios.q(), criterios.desde(), criterios.hasta(),
                criterios.cajero(), criterios.metodoPago());

        TotalesNotasCreditoDTO acreditado = devolucionRepository.sumarNotasCreditoDeVentas(
                criterios.q(), criterios.desde(), criterios.hasta(),
                criterios.cajero(), criterios.metodoPago());

        BigDecimal ventasBrutas = normalizar(brutos.total());
        BigDecimal itbisBrutos = normalizar(brutos.itbis());
        BigDecimal notasCredito = normalizar(acreditado.total());
        BigDecimal itbisNotasCredito = normalizar(acreditado.itbis());

        return new ReporteVentasDTO(
                ventas,
                ventasBrutas.subtract(notasCredito),
                itbisBrutos.subtract(itbisNotasCredito),
                normalizar(brutos.descuentos()),
                brutos.transacciones(),
                ventasBrutas,
                itbisBrutos,
                notasCredito,
                itbisNotasCredito,
                acreditado.cantidad());
    }

    /**
     * Todas las filas del período, paginadas contra la base para no cargar el
     * rango entero de una vez. La venta devuelta se lista igual: su NCF se
     * emitió y esconderla dejaría un hueco inexplicable en la secuencia.
     */
    private List<VentaResumenDTO> listarVentas(VentaFiltroDTO filtro) {
        List<VentaResumenDTO> todas = new ArrayList<>();
        int pagina = 0;
        Page<VentaResumenDTO> resultado;

        do {
            resultado = ventaService.listar(filtro, PageRequest.of(pagina, TAMANO_PAGINA));
            todas.addAll(resultado.getContent());
            pagina++;
        } while (pagina < resultado.getTotalPages() && todas.size() < MAXIMO_FILAS_LISTADAS);

        return todas;
    }

    /** Un período sin ventas suma cero, no nulo. */
    private BigDecimal normalizar(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }
}
