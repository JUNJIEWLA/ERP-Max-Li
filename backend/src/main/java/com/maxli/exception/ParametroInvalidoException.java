package com.maxli.exception;

/**
 * Un parámetro de consulta llegó mal formado o es incoherente con otro.
 * <p>
 * Se distingue de {@link BusinessException} (422, la petición es válida pero
 * el dominio la rechaza): aquí la petición misma está mal construida, así que
 * el contrato HTTP correcto es 400.
 */
public class ParametroInvalidoException extends RuntimeException {

    public ParametroInvalidoException(String message) {
        super(message);
    }
}
