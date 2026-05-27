-- Renombrar el campo 'codigo' a 'sku' (código interno auto-generado)
ALTER TABLE producto RENAME COLUMN codigo TO sku;

-- Hacer sku nullable temporalmente para que el backend lo genere tras el INSERT
ALTER TABLE producto ALTER COLUMN sku DROP NOT NULL;

-- Agregar campo codigo_barras (no único, nullable — puede no tener código de barras)
ALTER TABLE producto
    ADD COLUMN codigo_barras VARCHAR(100);

-- Índices
CREATE INDEX idx_producto_codigo_barras ON producto (codigo_barras);
