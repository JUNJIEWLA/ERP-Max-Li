package com.maxli.venta.entity;

/**
 * Métodos de pago soportados por el POS.
 * <p>
 * El flag {@code aplicaParaMayorista} determina si el método permite
 * mantener precios al por mayor. Tarjeta cobra comisión del adquirente,
 * lo que come el margen mayorista. Cheque tiene riesgo de rebote.
 */
public enum MetodoPago {

    EFECTIVO(true),
    TRANSFERENCIA(true),
    CHEQUE(false),
    TARJETA(false),
    CUPON(false),
    NOTA_CREDITO(true),
    MIXTO(false); // se evalúa por componentes individuales

    private final boolean aplicaParaMayorista;

    MetodoPago(boolean aplicaParaMayorista) {
        this.aplicaParaMayorista = aplicaParaMayorista;
    }

    public boolean isAplicaParaMayorista() {
        return aplicaParaMayorista;
    }
}
