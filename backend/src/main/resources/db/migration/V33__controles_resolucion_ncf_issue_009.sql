DO $$
DECLARE
    duplicados TEXT;
BEGIN
    SELECT string_agg(tipo_ncf || ' (' || cantidad || ' ACTIVA)', ', ' ORDER BY tipo_ncf)
    INTO duplicados
    FROM (
        SELECT tipo_ncf, COUNT(*) AS cantidad
        FROM resolucion_ncf
        WHERE estado = 'ACTIVO'
        GROUP BY tipo_ncf
        HAVING COUNT(*) > 1
    ) d;

    IF duplicados IS NOT NULL THEN
        RAISE EXCEPTION
            'V33 bloqueada: resoluciones NCF activas duplicadas: %. Corrija manualmente dejando solo una ACTIVO por tipo_ncf y cambiando las demás a INACTIVO, AGOTADO o VENCIDO antes de migrar.',
            duplicados;
    END IF;
END $$;

DO $$
DECLARE
    invalidos TEXT;
BEGIN
    SELECT string_agg(
        'id=' || id_resolucion
        || ' tipo=' || tipo_ncf
        || ' prefijo=' || prefijo
        || ' rango=' || secuencia_inicio || '-' || secuencia_final
        || ' actual=' || secuencia_actual
        || ' estado=' || estado,
        '; ' ORDER BY id_resolucion
    )
    INTO invalidos
    FROM resolucion_ncf
    WHERE tipo_ncf NOT IN ('B01', 'B02', 'B14', 'B15')
       OR prefijo <> tipo_ncf
       OR estado NOT IN ('ACTIVO', 'INACTIVO', 'VENCIDO', 'AGOTADO')
       OR secuencia_inicio <= 0
       OR secuencia_final <= 0
       OR secuencia_actual <= 0
       OR secuencia_inicio > secuencia_actual
       OR secuencia_actual > secuencia_final;

    IF invalidos IS NOT NULL THEN
        RAISE EXCEPTION
            'V33 bloqueada: resoluciones NCF con tipos, prefijos, estados o rangos inválidos: %. Para corregir: use tipo/prefijo B01, B02, B14 o B15; estado ACTIVO, INACTIVO, VENCIDO o AGOTADO; y rangos positivos con secuencia_inicio <= secuencia_actual <= secuencia_final.',
            invalidos;
    END IF;
END $$;

ALTER TABLE resolucion_ncf
    ADD CONSTRAINT chk_resolucion_ncf_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO', 'VENCIDO', 'AGOTADO')),
    ADD CONSTRAINT chk_resolucion_ncf_tipo_prefijo
        CHECK (tipo_ncf IN ('B01', 'B02', 'B14', 'B15') AND prefijo = tipo_ncf),
    ADD CONSTRAINT chk_resolucion_ncf_rango
        CHECK (
            secuencia_inicio > 0
            AND secuencia_final > 0
            AND secuencia_actual > 0
            AND secuencia_inicio <= secuencia_actual
            AND secuencia_actual <= secuencia_final
        );

CREATE UNIQUE INDEX ux_resolucion_ncf_activa_por_tipo
    ON resolucion_ncf (tipo_ncf)
    WHERE estado = 'ACTIVO';
