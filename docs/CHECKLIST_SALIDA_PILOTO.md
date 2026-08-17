# Checklist de salida a piloto — MaxLi Manager

Lista ejecutable para decidir **go / no-go** antes de que Plaza Max opere sobre
el sistema. Se completa **en el servidor y con el hardware reales**, en orden, y
se archiva firmada con fecha y responsable.

> **Un `ops/verificar-prepiloto.sh` en verde no autoriza el piloto.** Acredita
> lo que se puede comprobar desde el servidor. Las pruebas de hardware, red y
> recuperación exigen a una persona delante. Los pasos marcados **[manual]** no
> los cubre ningún script y no se dan por hechos.

Complementa `RUNBOOK_PILOTO.md`, que explica *cómo* se opera. Aquí se decide
*si* se abre.

| | |
|---|---|
| **Fecha** | |
| **Responsable técnico** | |
| **Responsable de negocio** | |
| **Commit desplegado** | |
| **Veredicto** | ☐ GO ☐ NO-GO |

---

## 1. Configuración operativa

Todo desde la UI con una cuenta ADMIN real. El gate comprueba que estos datos
existen; que sean *los correctos* solo lo sabe quien opera la tienda.

- [ ] **Empresa** **[manual]** — RNC, razón social y dirección verificados
      contra el registro de la DGII, y reflejados en la plantilla del
      comprobante impreso.
      > El sistema no almacena estos datos: no hay tabla `empresa`. Hoy viven en
      > la plantilla de impresión. Un NCF emitido con un RNC equivocado es un
      > problema fiscal, no un error de formato.
- [ ] **Usuarios y roles** — cuentas nominales creadas para cada persona que va
      a operar. Ninguna cuenta compartida.
- [ ] **Credencial inicial retirada** — el `admin` de la instalación cambió su
      contraseña y `BOOTSTRAP_ADMIN_PASSWORD` ya **no** está en el
      `EnvironmentFile`.
- [ ] **Almacén** — al menos uno `ACTIVO`, con el nombre que usa la tienda.
- [ ] **Caja** — al menos una `ACTIVO` **con almacén asignado**
      (Administración > Cajas). Una caja sin almacén abre turno y falla al
      facturar.
- [ ] **Stock inicial** — catálogo cargado y existencias cuadradas contra un
      conteo físico. Al menos un producto vendible con `cantidad_actual > 0`.
- [ ] **Precios e ITBIS** — revisados sobre una muestra: el precio de góndola
      coincide con el que imprime el POS.

## 2. Comprobantes fiscales

- [ ] **B02 (consumidor final)** dada de alta con su número de resolución,
      rango y fecha de vencimiento reales, en estado `ACTIVO`.
- [ ] **B04 (nota de crédito)** dada de alta igual, en estado `ACTIVO`.
      > Sin B04 vigente, una devolución revierte la operación completa: el
      > cliente se queda sin devolución y la tienda sin explicación.
- [ ] **Rangos revisados** — los números disponibles y la fecha de vencimiento
      cubren con margen la duración prevista del piloto.
- [ ] **[manual]** El rango cargado coincide **carácter a carácter** con el
      documento de autorización de la DGII.

## 3. Gate automático

```bash
export SPRING_PROFILES_ACTIVE=prod
set -a; . /etc/maxli/maxli.env; set +a       # DB_URL, JWT_SECRET, CORS…

ops/verificar-prepiloto.sh \
    --url-base http://127.0.0.1:8080 \
    --backup-dir /var/backups/maxli \
    --backup-externo /mnt/respaldo-maxli
```

- [ ] **Termina con `ENTORNO LISTO` y estado 0.**
- [ ] Los avisos (`aviso`) se leyeron y se decidió conscientemente sobre cada
      uno. Un aviso no bloquea, pero ignorarlo es una decisión, no un descuido.

Qué cubre, para no repetirlo a mano: perfil `prod`, variables de base, JWT,
CORS, HTTPS y cookie; conectividad con PostgreSQL; esquema al día y sin
migraciones fallidas; aplicación alcanzable; `liveness` y `readiness` en 200;
que un anónimo no pueda leer `/api/productos`; almacén, caja y usuarios
habilitados; B02 y B04 vigentes con números; y backup local y externo recientes
y con checksum válido.

## 4. Backup

- [ ] **Backup manual ejecutado** con copia externa exigida:

```bash
ops/backup-postgres.sh /var/backups/maxli \
    --externo /mnt/respaldo-maxli --exigir-externo
```

- [ ] **[manual]** El destino externo reside **fuera de este servidor** — otra
      máquina, un disco que no vive conectado o un bucket montado — y se
      comprobó que el recurso está montado de verdad, no que exista el
      directorio vacío del punto de montaje.
- [ ] **Cron diario instalado** (runbook §3) y su log revisado tras la primera
      ejecución real. Un cron que falla en silencio es peor que no tener
      backup: genera confianza sin respaldo detrás.
- [ ] **[manual]** Cifrado y custodia de la copia externa resueltos, con la
      clave guardada **aparte** del backup, y anotado quién tiene acceso.
- [ ] **Retención** aplicada (`find … -mtime +7 -delete`) y verificada sobre el
      directorio real.

## 5. Recuperación — ensayada, no supuesta

- [ ] **Ensayo automático de backup → copia externa → restauración:**

```bash
ops/ensayo-backup-restore.sh
```

  Crea bases desechables `maxli_ensayo_*`, aplica las migraciones reales,
  respalda, verifica la copia externa, restaura **desde ella** y borra las bases
  pase lo que pase. Nunca toca `maxli_db`.

- [ ] **[manual] Restauración de un backup real** sobre una base desechable, y
      comprobación de que la última migración coincide con la de producción. El
      ensayo automático usa datos sintéticos; esto usa el respaldo que de verdad
      habría que restaurar.

- [ ] **[manual] Ensayo del `ALTER DATABASE RENAME` con la aplicación
      detenida.** Es el paso que convierte una base restaurada en la base en
      producción, y el único que nadie ha hecho nunca la primera vez que hace
      falta:

```bash
sudo systemctl stop maxli
createdb -U postgres --owner=maxli maxli_ensayo_rename
psql -U postgres -d postgres <<'SQL'
ALTER DATABASE maxli_db RENAME TO maxli_db_previa;
ALTER DATABASE maxli_ensayo_rename RENAME TO maxli_db;
SQL
# …comprobar que el rename funciona y deshacerlo…
psql -U postgres -d postgres <<'SQL'
ALTER DATABASE maxli_db RENAME TO maxli_ensayo_rename;
ALTER DATABASE maxli_db_previa RENAME TO maxli_db;
SQL
dropdb -U postgres maxli_ensayo_rename
sudo systemctl start maxli
```

  > Si algún `RENAME` se queja de conexiones abiertas, cerrarlas primero
  > (runbook §4). Descubrir ese detalle durante un incidente cuesta minutos que
  > no hay.

- [ ] Tiempo real del ensayo medido y comparado con el **RTO objetivo de ~60
      min**. Si no se cumple, el objetivo se corrige en el runbook: un RTO que
      nadie ha cronometrado es ficción.

## 6. Despliegue y rollback

- [ ] **Despliegue completo ejecutado** siguiendo el runbook §5, incluido el
      backup previo del paso 1.
- [ ] **Artefactos anteriores guardados**: `maxli-backend.jar.anterior` y
      `frontend.anterior` existen. Sin ellos no hay rollback, solo una
      reconstrucción a contrarreloj.
- [ ] **[manual] Rollback caso A ensayado** — volver al `.jar` y al frontend
      anteriores, arrancar, smoke test, y volver a la versión nueva.
- [ ] Ruta de rollback caso B (esquema incompatible) leída y entendida por quien
      estará de guardia. No hace falta ensayarla entera si el §5 ya se ensayó,
      pero sí saber que existe y dónde está.

## 7. Prueba real con hardware **[manual]**

Todo con el equipo, la red y el navegador de la tienda. Ninguno de estos puntos
responde a un `curl` desde el servidor.

- [ ] **Login** desde el navegador del punto de venta, sobre `https://`.
- [ ] **Lector de códigos de barras**: escanear un producto real lo añade al
      carrito, con el precio correcto.
- [ ] **Apertura de turno** con monto inicial.
- [ ] **Venta completa** cerrada, con NCF **B02** emitido.
- [ ] **Impresora**: el comprobante sale legible, completo, y con RNC, razón
      social y NCF correctos.
- [ ] **Devolución** de esa venta, con nota de crédito **B04** emitida e
      impresa.
- [ ] **Cierre de turno** con el cuadre correcto.
- [ ] **Existencia descontada y repuesta** correctamente tras la venta y la
      devolución.
- [ ] **Red de la tienda**: la prueba se hizo sobre el enlace real. Se probó qué
      pasa si se cae a mitad de una venta.

## 8. Observabilidad

- [ ] **Retención de logs configurada** (`journald`, runbook §9) y verificada:

```bash
journalctl -u maxli --since '1 hour ago' | tail -50
```

- [ ] Los logs de la prueba con hardware se revisaron: sin errores 5xx, sin
      trazas de excepción inesperadas.
- [ ] **[manual]** Alguien tiene acceso al servidor y sabe leer estos logs
      durante el horario de la tienda.

## 9. Protección de la rama `main` **[manual]**

Este repositorio **no** cambia la configuración de GitHub por su cuenta: alterar
la protección de una rama es una decisión de gobierno del proyecto, no un efecto
secundario de un script.

Pasos exactos, con un usuario con permiso de administración del repositorio:

1. **Settings** → **Branches** → **Add branch protection rule**
   (o editar la existente para `main`).
2. Branch name pattern: `main`.
3. Marcar **Require a pull request before merging**.
4. Marcar **Require status checks to pass before merging** y, dentro,
   **Require branches to be up to date before merging**.
5. En el buscador de checks, añadir exactamente:
   - `Quality`
   - `E2E`
6. **Save changes**.

- [ ] Regla creada y guardada.
- [ ] **Verificado en la práctica**: un PR con `Quality` o `E2E` en rojo no
      ofrece el botón de merge.

## 10. Veredicto

**GO** exige:

- Todas las casillas de las secciones 1 a 9 marcadas.
- `ops/verificar-prepiloto.sh` en `ENTORNO LISTO`.
- La venta y la devolución de la sección 7 completadas con comprobante impreso.
- Una restauración ensayada por una persona, cronometrada.

**NO-GO** ante cualquiera de estos, sin discutirlo:

- Falta la resolución B02 o la B04 vigente.
- No hay backup verificado **fuera** del servidor.
- Nadie ha restaurado nunca un backup de este sistema.
- La impresora o el lector no funcionan con el flujo real.
- Los datos fiscales de la empresa no están confirmados contra la DGII.
- No hay una persona identificada de guardia durante el horario de la tienda.

> Salir a piloto sin recuperación ensayada no es asumir un riesgo: es
> desconocerlo. La diferencia se nota el día del incidente, y para entonces ya
> no se puede decidir.

---

| Firma técnica | Firma de negocio | Fecha |
|---|---|---|
| | | |
