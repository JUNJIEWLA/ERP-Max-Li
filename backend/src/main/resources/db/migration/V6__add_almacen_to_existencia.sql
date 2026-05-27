ALTER TABLE existencia
    ADD COLUMN id_almacen BIGINT NOT NULL,
    ADD CONSTRAINT fk_existencia_almacen FOREIGN KEY (id_almacen) REFERENCES almacen (id_almacen);

CREATE INDEX idx_existencia_id_almacen ON existencia (id_almacen);
