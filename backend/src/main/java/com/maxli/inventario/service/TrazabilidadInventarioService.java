package com.maxli.inventario.service;

import com.maxli.almacen.entity.Almacen;
import com.maxli.exception.BusinessException;
import com.maxli.inventario.entity.DetalleMovimiento;
import com.maxli.inventario.entity.Movimiento;
import com.maxli.inventario.repository.MovimientoRepository;
import com.maxli.producto.entity.Producto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Registra el rastro de inventario dentro de la misma transacción que cambia
 * la existencia. El usuario, la fecha y los saldos se derivan en el servidor.
 */
@Service
@RequiredArgsConstructor
public class TrazabilidadInventarioService {

    private final MovimientoRepository movimientoRepository;

    public record CambioInventario(
            Producto producto,
            Integer cantidadAnteriorOrigen,
            Integer cantidadPosteriorOrigen,
            Integer cantidadAnteriorDestino,
            Integer cantidadPosteriorDestino) {

        public static CambioInventario salida(Producto producto, int anterior, int posterior) {
            return new CambioInventario(producto, anterior, posterior, null, null);
        }

        public static CambioInventario entrada(Producto producto, int anterior, int posterior) {
            return new CambioInventario(producto, null, null, anterior, posterior);
        }

        public static CambioInventario transferencia(Producto producto,
                                                       int anteriorOrigen, int posteriorOrigen,
                                                       int anteriorDestino, int posteriorDestino) {
            return new CambioInventario(producto, anteriorOrigen, posteriorOrigen,
                    anteriorDestino, posteriorDestino);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Movimiento registrar(String tipo,
                                Almacen almacenOrigen,
                                Almacen almacenDestino,
                                String referencia,
                                String observacion,
                                String usuario,
                                List<CambioInventario> cambios) {
        if (cambios == null || cambios.isEmpty()) {
            throw new BusinessException("El movimiento de inventario debe contener al menos un cambio real");
        }

        Movimiento movimiento = new Movimiento();
        movimiento.setTipo(tipo);
        movimiento.setAlmacenOrigen(almacenOrigen);
        movimiento.setAlmacenDestino(almacenDestino);
        movimiento.setReferencia(normalizarReferencia(tipo, referencia));
        movimiento.setObservacion(observacion);
        movimiento.setEstado("COMPLETADO");
        movimiento.setUsuarioResponsable(normalizarUsuario(usuario));
        movimiento.setFechaMovimiento(LocalDateTime.now());

        for (CambioInventario cambio : cambios) {
            validarCambio(cambio);
            DetalleMovimiento detalle = new DetalleMovimiento();
            detalle.setMovimiento(movimiento);
            detalle.setProducto(cambio.producto());
            detalle.setCantidad(cantidadCambio(cambio));
            detalle.setCantidadAnteriorOrigen(cambio.cantidadAnteriorOrigen());
            detalle.setCantidadPosteriorOrigen(cambio.cantidadPosteriorOrigen());
            detalle.setCantidadAnteriorDestino(cambio.cantidadAnteriorDestino());
            detalle.setCantidadPosteriorDestino(cambio.cantidadPosteriorDestino());
            movimiento.getDetalles().add(detalle);
        }

        return movimientoRepository.save(movimiento);
    }

    private void validarCambio(CambioInventario cambio) {
        if (cambio == null || cambio.producto() == null) {
            throw new BusinessException("Cada cambio de inventario debe identificar un producto");
        }
        validarPar(cambio.cantidadAnteriorOrigen(), cambio.cantidadPosteriorOrigen());
        validarPar(cambio.cantidadAnteriorDestino(), cambio.cantidadPosteriorDestino());
        int cantidad = cantidadCambio(cambio);
        if (cantidad <= 0) {
            throw new BusinessException("No se registran movimientos de inventario sin variación de stock");
        }
        if (cambio.cantidadAnteriorOrigen() != null && cambio.cantidadAnteriorDestino() != null) {
            int cantidadDestino = Math.abs(
                    cambio.cantidadPosteriorDestino() - cambio.cantidadAnteriorDestino());
            if (cantidad != cantidadDestino) {
                throw new BusinessException("Los saldos de la transferencia no concilian con la cantidad movida");
            }
        }
    }

    private void validarPar(Integer anterior, Integer posterior) {
        if ((anterior == null) != (posterior == null)) {
            throw new BusinessException("Los saldos anterior y posterior deben informarse juntos");
        }
        if (anterior != null && (anterior < 0 || posterior < 0)) {
            throw new BusinessException("Un movimiento no puede registrar saldos negativos");
        }
    }

    private int cantidadCambio(CambioInventario cambio) {
        if (cambio.cantidadAnteriorOrigen() != null) {
            return Math.abs(cambio.cantidadPosteriorOrigen() - cambio.cantidadAnteriorOrigen());
        }
        if (cambio.cantidadAnteriorDestino() != null) {
            return Math.abs(cambio.cantidadPosteriorDestino() - cambio.cantidadAnteriorDestino());
        }
        return 0;
    }

    private String normalizarUsuario(String usuario) {
        if (usuario != null && !usuario.isBlank()) {
            return usuario;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null && !authentication.getName().isBlank()) {
            return authentication.getName();
        }
        return "SISTEMA";
    }

    private String normalizarReferencia(String tipo, String referencia) {
        if (referencia != null && !referencia.isBlank()) {
            return referencia;
        }
        return tipo + "-" + UUID.randomUUID();
    }
}
