-- ═══════════════════════════════════════════════════════════════════
--  V37: Información de la empresa (singleton)
--
--  Esta tabla almacena los datos corporativos del negocio que opera el ERP:
--  nombre, RNC, dirección, contacto y presencia digital.
--
--  Diseño singleton: siempre existe exactamente UNA fila con id = 1.
--  El backend garantiza que nunca se crean filas adicionales.
--
--  Usos actuales y futuros de estos datos:
--    · Encabezado de facturas / comprobantes impresos
--    · Campo emisor en XML 608 para la DGII
--    · Remitente en correos de facturación
--    · Sidebar del ERP (nombre de empresa)
--    · Reportes de cierre de turno
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE configuracion_empresa (
    id                    BIGINT       PRIMARY KEY DEFAULT 1
                                       CHECK (id = 1),          -- singleton estricto

    -- Datos fiscales (obligatorios para comprobantes DGII)
    nombre_comercial      VARCHAR(200),
    razon_social          VARCHAR(200),
    rnc                   VARCHAR(20),                           -- 9 o 11 dígitos sin guiones

    -- Contacto
    telefono_principal    VARCHAR(30),
    telefono_secundario   VARCHAR(30),
    email_comercial       VARCHAR(150),
    email_facturacion     VARCHAR(150),                          -- remitente para envíos automáticos

    -- Dirección
    direccion             VARCHAR(500),
    ciudad                VARCHAR(100),
    provincia             VARCHAR(100),
    pais                  VARCHAR(100) DEFAULT 'República Dominicana',

    -- Presencia digital
    sitio_web             VARCHAR(255),
    logo_url              VARCHAR(500),                          -- URL o path; upload es épica separada

    -- Auditoría
    fecha_creacion        TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_modificacion    TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  configuracion_empresa                IS 'Datos corporativos del negocio. Singleton: siempre id=1.';
COMMENT ON COLUMN configuracion_empresa.rnc            IS 'Registro Nacional del Contribuyente. 9 dígitos (persona jurídica) o 11 (persona física).';
COMMENT ON COLUMN configuracion_empresa.email_facturacion IS 'Dirección usada como remitente en correos de comprobantes.';
COMMENT ON COLUMN configuracion_empresa.logo_url       IS 'URL o ruta al logo. Subida de archivos es funcionalidad futura.';

-- Insertar la fila singleton vacía para que siempre exista
INSERT INTO configuracion_empresa (id) VALUES (1);
