# Auditoría integral de preparación — MaxLi ERP

| Campo | Resultado |
|---|---|
| Fecha | 2026-08-16 |
| Rama / commit | `main` / `6033b77` |
| Sincronización | `git fetch --all --prune` + `git pull --ff-only origin main`: al día; todas las ramas remotas están integradas en `origin/main` |
| Trabajo local histórico | Existen 4 stashes de mayo/junio de 2026; se inspeccionaron y se dejaron intactos porque no es seguro asumir que deban reaplicarse |
| Aplicación auditada | Frontend Vite en `http://127.0.0.1:5173`; backend Spring Boot en `http://127.0.0.1:8080` |
| Base de prueba | PostgreSQL 18.4 aislado, creado desde cero; 28/28 migraciones Flyway aplicadas y esquema Hibernate validado |
| Objetivo | Determinar si está listo entre demo académica y piloto interno, sin exigir funcionalidades “premium” |

## Veredicto

**El proyecto sirve como demo académica funcional, pero todavía no está listo para un piloto interno con datos u operaciones reales.** El camino feliz principal ya existe —login, maestros, compra, recepción, gasto, apertura de caja y venta POS—, pero hay bloqueos de integridad en inventario, caja y fiscalidad. El más grave fue reproducido: dos ventas concurrentes confirmaron 18 unidades cuando solo había 9.

No recomiendo cargar inventario real, emitir NCF reales ni cuadrar efectivo real hasta cerrar los P0 y la primera ola de P1.

| Área | Estado | Evidencia principal |
|---|---|---|
| Repositorio y compilación | Bien | `main` actualizado; frontend compila; 66 pruebas backend pasan |
| Arranque desde cero | Bien con advertencia | 28 migraciones aplican; Flyway de la app advierte que PostgreSQL 18 no está certificado (objetivo declarado: PostgreSQL 15+) |
| Flujo feliz compra → recepción → gasto | Funciona | OC-0001, NR-0001 y gasto pendiente creados sobre base limpia |
| Flujo feliz caja → POS → NCF | Funciona en caso simple | VT-000001, NCF B0200000001 y stock 10→9 |
| Inventario bajo concurrencia | Bloqueado | Sobreventa confirmada: 2 respuestas 201 para 18 unidades con stock 9 |
| Caja | Bloqueado | El cambio entregado queda contado como efectivo en caja |
| Fiscalidad | Bloqueado | ITBIS fijo a 18%; resoluciones NCF duplicables y generación directa expuesta |
| Trazabilidad | Bloqueado | Recepciones y ventas cambian stock sin movimientos auditables |
| Seguridad | No apta para despliegue | Credencial inicial conocida sin rotación, secreto JWT por defecto, CORS local fijo y autorización granular no aplicada en backend |
| Frontend | Desktop utilizable; móvil no | Menú fijo ocupa 255 px de 390 px; contenido operativo queda comprimido |
| Automatización de calidad | Insuficiente | Sin pruebas frontend/E2E, sin integración real, sin prueba de concurrencia y sin CI |
| Operación/despliegue | Incompleto | README mínimo; sin perfil productivo, contenedores, healthcheck, backup/restore ni runbook |

## Qué sí funciona

- La aplicación arranca contra una base totalmente vacía y las 28 migraciones terminan correctamente.
- El backend compila y ejecuta **66 pruebas**, con 0 fallos, 0 errores y 0 omitidas.
- El frontend produce build de producción correctamente.
- Login JWT, sesión, cambio obligatorio de contraseña para usuarios nuevos y revocación por `token_version` están implementados.
- CRUD básico comprobado para categoría, marca, proveedor, producto y caja.
- Compra y validación de tres vías funcionan en el caso feliz: orden enviada, recepción completa confirmada y gasto habilitado después de recibir.
- El POS bloquea ventas si no hay turno abierto.
- Una venta simple genera número de control y NCF, descuenta stock y actualiza el turno.
- La secuencia NCF sí usa bloqueo pesimista dentro de una única resolución activa.
- Hay paginación en la mayoría de listados y borrado lógico en varios maestros.

## Bloqueos críticos

### ISSUE-004 — Sobreventa confirmada bajo concurrencia

| Campo | Valor |
|---|---|
| Prioridad | **P0 — bloqueo crítico** |
| Categoría | Integridad / concurrencia |
| Evidencia | [Venta B01](evidence/issue-004-venta-b01.json) · [Venta B02](evidence/issue-004-venta-b02.json) |

Con 9 unidades disponibles se enviaron simultáneamente dos ventas de 9, una B01 y otra B02. Ambas respondieron HTTP 201 y persistieron ventas por 18 unidades; la existencia final quedó en 0. `VentaService` lee con `findFirstByProducto_IdProducto`, valida y guarda sin bloqueo sobre la existencia ni `@Version`. El bloqueo NCF no protege el stock entre dos tipos de comprobante.

**Criterio de cierre:** bloquear la existencia durante validación/decremento o aplicar control optimista; aplicar la misma disciplina a recepción, ajuste, conteo y transferencia; solo una venta puede confirmar y la otra debe fallar sin NCF ni movimientos parciales. Añadir pruebas de integración concurrentes.

### ISSUE-006 — El cambio entregado infla el cuadre de efectivo

| Campo | Valor |
|---|---|
| Prioridad | **P0 — bloqueo crítico** |
| Categoría | Caja / contabilidad |
| Evidencia | [Datos antes, venta y después](evidence/issue-006-cuadre-cambio.json) |

Una venta de RD$130 pagada con RD$200 devuelve RD$70 de cambio. El turno pasó de RD$3,470 a RD$3,670, cuando debía quedar en RD$3,600. La consulta suma `IngresoVenta.monto` completo y no descuenta `Venta.cambio`. Además, el método principal y los métodos de los ingresos pueden contradecirse y el backend admite “cambio” en pagos no efectivos.

**Criterio de cierre:** calcular efectivo neto (recibido menos cambio), validar la composición de pagos contra el método principal y permitir sobrepago/cambio únicamente donde corresponda. Cubrir efectivo exacto, cambio, tarjeta, mixto y cierre de turno.

### ISSUE-007 — Una venta no identifica el almacén y descuenta una existencia arbitraria

| Campo | Valor |
|---|---|
| Prioridad | **P0 — bloqueo crítico** |
| Categoría | Inventario / diseño de contrato |

`CrearVentaRequestDTO` no contiene almacén y `VentaService` toma la primera existencia del producto. Con el mismo producto en varios almacenes, puede descontar el local equivocado, fallar aunque otro tenga stock o vender mercancía no disponible en la tienda/caja actual.

**Criterio de cierre:** asociar caja/venta a almacén, pedir o derivar `idAlmacen`, bloquear exactamente `(producto, almacén)` y conservar ese origen en el detalle/movimiento.

### ISSUE-008 — El total fiscal calcula siempre ITBIS de 18%

| Campo | Valor |
|---|---|
| Prioridad | **P0 — bloqueo crítico** |
| Categoría | Fiscal / cálculo |

Cada producto guarda `tasaItbis`, pero el preview y la venta dividen el total completo entre `1.18`. Productos exentos o con otra tasa quedan facturados incorrectamente; descuentos globales/cupones tampoco se distribuyen por línea/tasa. Los DTO de venta tampoco limitan descuento global a valores no negativos ni descuento de línea a 0–100.

**Criterio de cierre:** calcular base e ITBIS por línea según la tasa del producto, definir cómo prorratear descuentos y validar rangos. Añadir casos exento, gravado, mixto, cupón, descuento y redondeo.

## Hallazgos necesarios para piloto

### ISSUE-001 — El Dashboard presenta información ficticia como operativa

| Campo | Valor |
|---|---|
| Prioridad | P1 |
| Evidencia | [Captura](screenshots/issue-001-dashboard-simulado.png) |

Una base sin ventas muestra RD$45,230.50, 127 órdenes, 2,543 productos y ventas recientes. No hay petición de dashboard; son valores estáticos. Debe usar datos reales y mostrar ceros/estado vacío.

### ISSUE-002 — Devoluciones simula operaciones fiscales que no se persisten

| Campo | Valor |
|---|---|
| Prioridad | P1 |
| Evidencia | [Captura](screenshots/issue-002-devoluciones-simuladas.png) |

La pantalla muestra devoluciones y B04 inexistentes. “Nueva Devolución” usa una venta fija y termina con éxito sin API, reposición de inventario ni nota de crédito. Debe ocultarse para el piloto o implementarse transaccionalmente contra ventas reales, con límites de cantidad, stock y B04 persistido.

### ISSUE-005 — Ventas y recepciones cambian stock sin movimientos auditables

| Campo | Valor |
|---|---|
| Prioridad | P1 |
| Evidencia | [Captura](screenshots/issue-005-sin-trazabilidad-ventas.png) |

Tras recibir 10 unidades y ejecutar ventas, el stock cambió 0→10→0 pero el historial quedó en cero. Toda recepción, venta, ajuste, conteo y transferencia debe crear, en la misma transacción, un movimiento con usuario, fecha, referencia y cantidades anterior/posterior.

### ISSUE-009 — Controles NCF incompletos permiten romper y consumir secuencias

| Campo | Valor |
|---|---|
| Prioridad | P1 alto |
| Evidencia | [Resolución duplicada y error 500](evidence/issue-009-ncf-duplicada.json) · [Cajero consume NCF](evidence/issue-009-cajero-consume-ncf.json) |

El sistema aceptó una segunda resolución B02 activa (HTTP 201); el siguiente intento de generar NCF terminó en HTTP 500 porque la consulta esperaba una sola. No hay unicidad activa por tipo, validación inicio≤fin ni validación suficiente de prefijo/tipo. Además, un usuario `CAJERO` recién creado, todavía marcado para cambio obligatorio de contraseña, llamó `POST /api/ncf/generar/B01` y consumió B0100000002 fuera de una venta (HTTP 200).

**Criterio de cierre:** una sola resolución activa por tipo con restricción de base de datos, rangos válidos, transición explícita, generación únicamente dentro del caso de uso autorizado y errores de dominio consistentes.

### ISSUE-010 — Línea base de seguridad no apta para despliegue

| Campo | Valor |
|---|---|
| Prioridad | P1 alto |

- La migración publica `admin / Admin@2026` y después marca al admin con `requiere_cambio_password=false`.
- El cambio obligatorio de contraseña se impone en la UI, pero el token emitido antes del cambio sigue pudiendo ejecutar la API; la prueba de cajero consumió un NCF en ese estado.
- La aplicación puede arrancar con un secreto JWT de desarrollo conocido si falta `JWT_SECRET`.
- `CORS_ALLOWED_ORIGINS` está documentado, pero `SecurityConfig` ignora la propiedad y fija solo localhost.
- El JWT dura 24 horas y se guarda en `localStorage`; un XSS puede extraerlo.
- El login no tiene límite de intentos, retardo ni bloqueo temporal contra fuerza bruta.
- El filtro JWT imprime usuario, roles y detalles de autenticación con `System.out` en cada petición.
- Crear/resetear contraseñas las muestra como `type="text"`.
- `npm audit --omit=dev` reporta 1 dependencia directa de severidad alta (`react-router` 7.13.0; arreglo disponible 7.18.2). Hoy el router ni siquiera se usa, lo que reduce exposición de algunas rutas vulnerables, pero debe actualizarse o retirarse.

**Criterio de cierre:** no incluir credencial utilizable, exigir secretos fuertes al arrancar, forzar rotación inicial, CORS configurable, campos de contraseña ocultos, logging estructurado sin datos innecesarios y dependencias sin vulnerabilidades altas conocidas.

### ISSUE-011 — Los permisos granulares se aplican en la interfaz, no como autoridad del backend

| Campo | Valor |
|---|---|
| Prioridad | **P0 de seguridad antes de exponer datos reales** |
| Evidencia | [Cajero crea proveedor y lee gastos](evidence/issue-011-cajero-autorizacion.json) |

El frontend oculta vistas por permisos y permite usuarios personalizados “sin rol”. El backend, sin embargo, solo carga los roles como `GrantedAuthority`; ni siquiera incorpora los permisos granulares al contexto de Spring Security. Después protege operaciones principalmente con nombres de rol (`ADMIN`, `SUPERVISOR`, `CAJERO`) y deja el resto bajo `authenticated()`. Se confirmó que un `CAJERO`, todavía pendiente de cambiar su contraseña, creó un proveedor (HTTP 201) y leyó los gastos (HTTP 200). Compras, proveedores, gastos, movimientos, conteos y otros endpoints no tienen una matriz completa en `SecurityConfig`. Además, quitar un permiso a un supervisor no necesariamente le quita la operación en la API, mientras un usuario personalizado con el permiso visible queda sin autoridad utilizable en backend.

**Criterio de cierre:** definir una única matriz de permisos y hacerla obligatoria en cada endpoint sensible mediante autoridades/permisos, con pruebas 401/403 por rol y por permiso. La UI solo debe reflejar, nunca sustituir, esa decisión.

### ISSUE-012 — La cobertura automatizada no protege los flujos de mayor riesgo

| Campo | Valor |
|---|---|
| Prioridad | P1 |

Hay 13 clases y 66 pruebas backend, principalmente unitarias con mocks, para 26 servicios. No hay pruebas de `VentaService`, `NcfService`, autenticación/controladores, repositorios, Flyway, seguridad, integración con PostgreSQL ni concurrencia. El frontend tiene 0 pruebas y tampoco scripts de lint o type-check independiente. No existe `.github/workflows` ni otro pipeline de CI que ejecute build/auditorías.

**Criterio de cierre mínimo:** integración PostgreSQL para venta/stock/NCF/caja, seguridad por roles/permisos, migración desde cero, concurrencia de stock y NCF; smoke E2E de login→compra→recepción→venta→cierre; frontend con al menos pruebas de los cálculos/estados críticos; todo obligatorio en CI.

### ISSUE-013 — La interfaz móvil es inutilizable

| Campo | Valor |
|---|---|
| Prioridad | P1 si POS/tablet/móvil entra en el piloto; P2 si el piloto será solo escritorio |
| Evidencia | [Captura 390×844](screenshots/responsive-mobile-390.png) |

En 390 px, el sidebar fijo ocupa aproximadamente 255 px y deja ~135 px para títulos, filtros, métricas y tablas. No hay menú colapsable ni adaptación de tablas. El POS debe probarse al menos en la resolución real del dispositivo objetivo.

### ISSUE-014 — No existe la alarma automática de stock definida como requisito

| Campo | Valor |
|---|---|
| Prioridad | P1 |

El backend permite consultar `cantidadActual < cantidadMinima`, pero no publica evento, notifica, persiste alerta ni integra el buzón. El buzón actual solo consulta alertas de costo y retraso de compras. Debe generarse/recalcularse la alerta al vender, recibir, ajustar, contar o transferir.

### ISSUE-015 — Falta el paquete operativo para ejecutar y recuperar un piloto

| Campo | Valor |
|---|---|
| Prioridad | P1 |

El README solo explica `npm i` y `npm run dev`; no documenta backend, PostgreSQL, variables, seed, migraciones ni credenciales. No hay perfil/configuración de producción, Docker/Compose, health/readiness, HTTPS/reverse proxy, estrategia de backup/restore, observabilidad, retención de logs, despliegue reproducible ni rollback. `dist/` está versionado y el build genera un bundle JS de ~1.25 MB.

En higiene de repositorio quedan cuatro stashes antiguos (`feature/ofertas-simple`, `fix/backend-migrations-startup`, `feature/s2-turno-caja` e `ian-setup`). No se aplicaron: contienen trabajo local histórico y algunos artefactos de `dist`; deben revisarse con sus autores y conservarse o eliminarse explícitamente.

**Criterio de cierre:** procedimiento reproducible de instalación y despliegue, variables validadas, healthcheck, copia/restauración probada, logs/monitoreo mínimo y runbook de incidente/rollback.

## Mejoras importantes, no bloqueantes por sí solas

### ISSUE-003 — Notas de Crédito está expuesto pero vacío

| Campo | Valor |
|---|---|
| Prioridad | P2 |
| Evidencia | [Captura](screenshots/issue-003-notas-credito-en-desarrollo.png) |

La navegación ofrece el módulo, pero la vista solo dice que está en desarrollo. Retirarlo del piloto o implementar consulta, detalle, estado e impresión real.

### ISSUE-016 — Navegación, búsqueda y calidad de interfaz están incompletas

| Campo | Valor |
|---|---|
| Prioridad | P2 |

- `react-router` está instalado pero la app cambia un `activeView`; la URL siempre queda en `/`, no hay enlaces profundos y recargar vuelve al Dashboard.
- La búsqueda global del encabezado es un input sin estado ni handler.
- “Generar reporte” en órdenes de compra y notas de recepción solo muestra un toast durante 3 segundos; no genera, descarga ni persiste ningún documento. No existe un módulo real de reportes operativos/financieros.
- `JSON.parse` de roles/permisos en `localStorage` no está protegido contra datos corruptos y puede romper el arranque.
- El navegador mostró warnings de React por pasar `ref` a componentes funcionales sin `forwardRef`.
- Auditoría axe de la pantalla visitada: 2 reglas violadas (contraste en 8 encabezados y un `select` sin nombre accesible).
- El build advierte chunk JS de ~1,247 kB; todas las pantallas se importan de forma eager.

### ISSUE-017 — La documentación de arquitectura no representa completamente la implementación

| Campo | Valor |
|---|---|
| Prioridad | P2 |

El documento indica React Router y Axios, pero la aplicación usa estado manual y `fetch`. También exige paginación en cada listado, trazabilidad con usuario/fecha, CORS explícito configurable y alerta automática de stock, que no se cumplen de forma completa. Sus páginas finales de interfaces, trazabilidad y glosario continúan como plantillas sin completar.

## Matriz de verificación ejecutada

| Prueba | Resultado |
|---|---|
| `git fetch --all --prune` y `git pull --ff-only origin main` | Pasa; `HEAD == origin/main == 6033b77`; ninguna rama remota pendiente de merge |
| `npm run build` | Pasa; advertencia de bundle JS grande (~1,247.05 kB, gzip ~297.57 kB) |
| `mvn test` | Pasa; 66/66 pruebas |
| Base limpia + Flyway | Pasa; 28/28 migraciones y `ddl-auto: validate` |
| Login y sesión | Pasa en caso feliz |
| CRUD de maestros | Pasa en muestra funcional |
| Compra → recepción → gasto | Pasa en caso feliz |
| POS sin turno | Pasa: bloquea |
| Turno + venta simple + NCF + stock | Pasa en caso feliz |
| Dos ventas concurrentes sobre el mismo stock | **Falla: ambas confirman** |
| Venta en efectivo con cambio | **Falla: cuadre inflado por el cambio** |
| Trazabilidad de stock de recepción/venta | **Falla: cero movimientos** |
| Segunda resolución activa del mismo NCF | **Falla: acepta y luego genera HTTP 500** |
| Dashboard sobre base vacía | **Falla: datos ficticios** |
| Devolución | **Falla: simulación sin persistencia** |
| Responsive 390×844 | **Falla: contenido comprimido/inoperable** |
| Accesibilidad automatizada, pantalla visitada | 2 violaciones axe; 1 comprobación incompleta |
| `npm audit --omit=dev` | **Falla: 1 vulnerabilidad directa alta** |
| OWASP Dependency-Check del backend | Inconcluso: la primera sincronización de NVD requería 378,386 registros y, sin API key, avanzó solo a 63%; no debe interpretarse como “sin vulnerabilidades” |
| Frontend/E2E/CI | No existen |

## Cobertura de los requisitos declarados

| Requisito de arquitectura | Estado observado |
|---|---|
| Evitar inventario negativo/sobreventa | **No cumplido:** no queda negativo por el lost update, pero persiste el doble de unidades disponibles |
| Alarma automática al llegar al mínimo | **No cumplido:** solo existe consulta manual de bajo stock |
| Control de tres vías compra–recepción–gasto | **Cumplido en camino feliz**, sin cobertura de integración/concurrencia suficiente |
| Trazabilidad con usuario, fecha y documento | **No cumplido** para cambios de stock por recepción, venta y ajuste directo |
| Concurrencia en procesos críticos | **No cumplido** en existencias; parcial en NCF y caja chica |
| Roles y permisos granulares | **Parcial:** UI granular, backend mayormente por rol fijo |
| Reportes operativos/financieros | **No cumplido:** dashboard simulado y botones de reporte sin salida |
| Eliminación lógica de maestros | **Parcial:** presente en varios maestros, no auditada de punta a punta |
| Listados paginados | **Mayormente cumplido**, con excepciones usadas por selectores/NCF/empaques |
| Secretos externos y CORS configurable | **No cumplido** para un despliegue real |
| Arquitectura SPA con rutas | **No cumplido:** una sola URL y navegación por estado local |

## Orden recomendado de trabajo

1. **Integridad transaccional:** concurrencia de stock, selección de almacén, movimientos auditables y pruebas PostgreSQL reales.
2. **Cerrar autorización backend:** denegar por defecto y exigir permisos concretos para compras, proveedores, gastos, inventario, NCF y demás operaciones.
3. **Exactitud monetaria/fiscal:** efectivo neto y cambio, ITBIS por tasa/línea, validaciones de descuentos/pagos y controles NCF.
4. **Seguridad restante:** credencial inicial, secretos obligatorios, CORS, contraseñas/logs/token y dependencia vulnerable.
5. **Eliminar simulaciones:** Dashboard real; ocultar o implementar Devoluciones y Notas de Crédito.
6. **Gate de calidad:** pruebas de integración/concurrencia/E2E y CI obligatorio.
7. **Preparar operación:** configuración productiva, despliegue reproducible, healthcheck, backup/restore, observabilidad y documentación.
8. **Adecuar el cliente objetivo:** responsive del dispositivo real, navegación, búsqueda, accesibilidad y carga diferida.

## Definición mínima de “listo para piloto”

El proyecto puede considerarse listo cuando:

- todos los P0 están corregidos y cubiertos por pruebas automatizadas;
- no quedan credenciales/secrets por defecto ni operaciones sensibles protegidas solo por UI;
- NCF, ITBIS, caja e inventario pasan casos felices, errores y concurrencia sin inconsistencias;
- todo cambio de stock es trazable;
- ninguna pantalla visible presenta datos o éxitos simulados;
- existe CI verde y un smoke E2E repetible;
- se puede desplegar, monitorear, respaldar y restaurar siguiendo documentación probada;
- la interfaz funciona en el tamaño de pantalla decidido para el piloto.
