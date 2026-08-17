# Contexto para continuar la estabilización de ERP Max Li

## Objetivo

Dejar el proyecto listo en lo básico y necesario: sin fallos críticos en autorización, ventas, caja, inventario, NCF, migraciones y flujos principales. Se está trabajando problema por problema, con pruebas RED → GREEN, una rama y un PR por corrección, sin mezclar cambios ni hacer merge antes de revisar.

## Repositorio y reglas de trabajo

- Repositorio: `JUNJIEWLA/ERP-Max-Li`.
- Rama base: `main`.
- Estado verificado al cerrar el hilo anterior: `main` en `f1c66ea`, merge de PR #21.
- Antes de cada fix: cambiar a `main`, ejecutar `git pull --ff-only`, comprobar el estado y crear una rama nueva.
- No tocar ni incluir `audit-output/`; permanece sin trackear intencionalmente.
- No borrar ramas antiguas ni stashes sin revisar con sus autores.
- Implementar primero pruebas que reproduzcan el defecto, confirmar RED, aplicar el arreglo y confirmar GREEN.
- Ejecutar pruebas específicas repetidamente cuando haya concurrencia, después `mvn test` completo y `npm run build`.
- Revisar el diff, hacer commit y push, abrir el PR y dejarlo sin merge para revisión.
- No afirmar que un escenario está cubierto si falta su prueba solicitada.

## Trabajo ya completado

### PR #16 — Autorización y permisos

- Matriz endpoint → permiso completa.
- Respuestas JSON uniformes para 401/403.
- `denyAll()` por defecto.
- Permisos faltantes añadidos por migración.
- Pruebas de autorización y carga de permisos.

### PR #17 — Sobreventa concurrente

- Bloqueo pesimista de existencias durante ventas.
- Agrupación por producto y orden determinista de bloqueos.
- Validación de stock antes de consumir NCF.
- Prueba concurrente con PostgreSQL real.

### PR #18 — Cuadre de caja

- El efectivo se calcula neto: recibido menos cambio entregado.
- Validación de composición de pagos y sobrepagos.
- Pruebas de cierre y diferentes métodos de pago.

Pendientes descubiertos fuera de ese alcance: bucket de cupón en el cuadre y defectos del flujo de tarjeta del frontend.

### PR #19 — Almacén explícito por caja

- Cada caja se relaciona con un almacén.
- La venta descuenta del almacén de la caja/turno, no de una existencia arbitraria.
- Bloqueo por producto y almacén exactos.
- Validación de almacén activo.
- No se permite reasignar el almacén con turno abierto, salvo configuración inicial.
- Migración conservadora: solo autoasigna si existe exactamente un almacén activo.

### PR #20 — ITBIS por línea

- Cálculo según la tasa real de cada producto, respetando productos exentos y carritos mixtos.
- Orden de descuentos: línea/oferta → global → cupón elegible.
- Prorrateo exacto al centavo.
- Preview y venta persistida producen los mismos totales sin consumir el cupón en el preview.
- Eliminado el endpoint muerto que consumía cupones fuera de una venta.
- Frontend dejó de simular `/1.18`.

### PR #21 — Bloqueos completos de inventario

- Servicio común con `PESSIMISTIC_WRITE` para todos los escritores de existencia.
- Cubiertos: ventas, recepciones, transferencias, conteos físicos y ajustes manuales.
- Transferencias bloquean claves en orden global para evitar deadlocks.
- Conteos aplican diferencias sobre el saldo bloqueado actual.
- Ajuste manual usa una variación atómica `deltaCantidadActual`; no permite reasignar producto/almacén.
- Creación concurrente segura de existencias.
- Pruebas PostgreSQL reales para venta/recepción, venta/ajuste, venta/conteo, transferencias inversas, creación concurrente, rollback multilínea, almacenes distintos y doble aplicación de conteo.
- Resultado final informado: 131 pruebas backend verdes y build frontend correcto.

## Próximo trabajo: ISSUE-009 — Controles NCF

La siguiente rama debe ser `fix/controles-ncf-issue-009`.

Alcance acordado:

- Catálogo cerrado: `B01`, `B02`, `B14`, `B15`; `prefijo` debe coincidir con `tipoNcf`.
- Una sola resolución `ACTIVO` por tipo mediante índice parcial de PostgreSQL.
- Validaciones de secuencias, rango, fecha y estados tanto en servicio como en base de datos.
- Estados previstos: `ACTIVO`, `INACTIVO`, `VENCIDO`, `AGOTADO`.
- Mantener el bloqueo pesimista y el consumo del NCF dentro de la transacción de la venta.
- Eliminar el endpoint público `POST /api/ncf/generar/{tipoNcf}`; el NCF solo se consume desde `VentaService.procesarVenta`.
- Mantener el preview para `VENTA_CREAR` y `NCF_GESTIONAR`, sin consumir ni reservar un número.
- Traducir conflictos y restricciones conocidas a errores de dominio JSON; no devolver errores SQL como 500 crudo.
- Evitar que una actualización invalide NCF ya emitidos.
- Añadir pruebas de duplicados activos, coexistencia inactiva, datos inválidos, resolución vencida/inactiva/agotada, acceso directo de CAJERO, concurrencia, rollback, migración con datos heredados inválidos y formato JSON de errores.

### Correcciones obligatorias al plan de ISSUE-009

1. `secuenciaActual` actualmente representa el próximo número a emitir. Al emitir el último NCF debe permanecer igual a `secuenciaFinal` y la resolución pasar a `AGOTADO`; no debe incrementarse a `secuenciaFinal + 1`, porque violaría el nuevo CHECK.
2. El PUT general no debe aceptar cambios directos de `estado` ni de `secuenciaActual`. Activar y desactivar debe hacerse mediante operaciones explícitas. `AGOTADO` debe ser controlado internamente.
3. No se debe marcar una resolución `VENCIDO` y luego lanzar una excepción dentro de la misma transacción esperando guardar el estado: la excepción revierte el cambio. La expiración debe tratarse como estado efectivo calculado o mediante una transición separada que realmente se confirme.
4. El preview es informativo: no reserva ni garantiza que ese será el NCF finalmente asignado.
5. La migración debe fallar de forma explícita ante datos heredados incompatibles e indicar cuáles registros deben corregirse. Conviene incluir consultas de preflight o un mensaje de migración suficientemente accionable.
6. Capturar violaciones de integridad por nombre/tipo de restricción; no convertir indiscriminadamente cualquier `DataIntegrityViolationException` en “resolución duplicada”.

## Forma de colaboración esperada

Cuando una IA entregue un resultado:

1. Revisar brevemente que el cambio coincida con el alcance.
2. Verificar pruebas, riesgos y archivos no deseados.
3. Si falta algo, producir un prompt concreto para corregirlo en la misma rama y PR.
4. Si está completo, indicar si se puede mergear y entregar el prompt del siguiente fix.
5. Priorizar el 20% de problemas que aporta el 80% de estabilidad; evitar funcionalidades decorativas hasta cerrar los riesgos básicos.

## Estado inmediato

El siguiente paso es entregar el plan corregido de ISSUE-009 a Codex o Claude Code, pedir que lo implemente en una rama nueva, que abra un PR sin merge y que presente evidencia RED → GREEN.

Antes de cambiar de rama, revisar el archivo sin trackear `backend/src/test/java/com/maxli/ncf/service/NcfServiceIssue009Test.java`. No fue creado ni modificado al preparar este contexto y puede ser trabajo ya iniciado de ISSUE-009; debe conservarse y decidirse conscientemente si se incorpora a la nueva rama. También permanece sin trackear `audit-output/`.
