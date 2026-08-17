-- ═══════════════════════════════════════════════════════════════════
--  V35: Inutiliza la credencial administrativa publicada (ISSUE-010)
--
--  V8 creó el usuario 'admin' con la contraseña Admin@2026 —documentada en
--  el propio repositorio— y V21 le quitó además la obligación de cambiarla.
--  Cualquier instalación, nueva o existente, quedaba con una cuenta de control
--  total cuya contraseña es pública.
--
--  V8 y V21 no se tocan: pueden estar ya aplicadas en bases reales y Flyway
--  rechazaría el checksum. Esta migración corrige el dato hacia adelante.
--
--  Qué hace:
--    · Solo actúa sobre el admin que CONSERVA el hash publicado en V8. Si en
--      esa base alguien ya rotó la contraseña, no se toca nada.
--    · Sustituye el hash por un centinela que BCrypt jamás puede validar, de
--      modo que la cuenta queda sin credencial utilizable.
--    · Marca requiere_cambio_password y sube token_version para invalidar
--      cualquier sesión emitida con la credencial conocida.
--
--  Cómo se recupera el acceso: arrancar una vez con BOOTSTRAP_ADMIN_PASSWORD
--  definido. AdminBootstrapService detecta el centinela, fija esa contraseña
--  una sola vez y obliga a cambiarla en el primer inicio de sesión.
-- ═══════════════════════════════════════════════════════════════════

UPDATE usuario
SET password_hash           = 'LOCKED::BOOTSTRAP_ADMIN_PASSWORD',
    requiere_cambio_password = true,
    token_version           = token_version + 1
WHERE username = 'admin'
  AND password_hash = '$2a$10$oqR3egEbQrfRrMPrvtdIueqhTImOq5Ix/U67c2rP3TzOFrcO2MvJ2';
