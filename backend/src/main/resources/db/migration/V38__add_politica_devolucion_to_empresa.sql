-- ═══════════════════════════════════════════════════════════════════
--  V38: Añadir campo de Política de Devolución a la Empresa
--
--  Permite personalizar los términos de devoluciones y cambios del negocio.
--  Se imprime al pie de las facturas A4 y tickets térmicos de 80mm.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE configuracion_empresa
    ADD COLUMN IF NOT EXISTS politica_devolucion TEXT;

COMMENT ON COLUMN configuracion_empresa.politica_devolucion
    IS 'Términos y condiciones de cambio o devolución impresos al final de tickets y facturas.';

-- Establecer texto predeterminado para la empresa si está vacío o nulo
UPDATE configuracion_empresa
SET politica_devolucion = 'Cambios válidos dentro de los 30 días presentando este comprobante y el producto en su empaque original. No se realiza devolución de dinero en efectivo.'
WHERE id = 1 AND (politica_devolucion IS NULL OR politica_devolucion = '');
