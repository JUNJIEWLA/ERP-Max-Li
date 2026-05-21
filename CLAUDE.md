# CLAUDE.md — MaxLi Manager (ERP Plaza Max)

Este archivo orienta a Claude Code (y a cualquier asistente IA) al trabajar en este repositorio. Léelo completo antes de hacer cambios.

**Repo:** https://github.com/JUNJIEWLA/ERP-Max-Li
**Autores:** Willian Li Liang, Ian Alvarez
**Documento de arquitectura:** `ArquitecturaCandidata3.pdf` (raíz del repo)

---

## 1. Qué es este proyecto

**MaxLi Manager** es un sistema de gestión integral para Plaza Max (tienda por departamentos). Centraliza el ciclo: **Compras → Recepción → Inventario → Venta (POS) → Cuentas por Pagar**.

No es un ERP genérico. Tiene reglas duras que el sistema **debe** hacer cumplir, no sugerir:

1. **No se vende sin stock.** `Existencia.cantidadActual >= cantidad` antes de confirmar venta. Cero stock negativo.
2. **Validación de 3 vías** para pagar a proveedores: `OrdenCompra` → `NotaRecepcion` (estado `RECEPCIONADO`) → recién entonces `PagoProveedor`. Sin recepción, no hay pago.
3. **Stock Alarma:** cuando `cantidadActual < cantidadMinima`, se dispara un evento de reposición. No es manual.
4. **Eliminación lógica** en maestros (Producto, Proveedor, Usuario): cambiar `estado` a `INACTIVO`. Jamás `DELETE` físico.
5. **NCF secuenciales y thread-safe**: la asignación de comprobantes fiscales debe ser atómica. Cero duplicados en concurrencia.
6. **Atomicidad de venta:** `Venta + DetalleVenta + decremento Existencia + Movimiento` van en una sola transacción (`@Transactional`). Si una falla, revierten todas.
7. **Trazabilidad:** cada movimiento crítico registra `usuario`, `fecha`, `acción`. Bitácora siempre.

Si una propuesta de cambio rompe alguna de estas 7 reglas, **deténgase y consulte** antes de implementar.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite | React 18, Vite 5 |
| Routing | React Router | 6.x |
| HTTP client | Axios | 1.x |
| Estado | Context API o Zustand | — |
| UI | shadcn/ui o Ant Design | — |
| Backend | Java + Spring Boot | Java 21 LTS, Spring Boot 3.x |
| Seguridad | Spring Security + JWT | 6.x |
| ORM | Spring Data JPA + Hibernate | 3.x / 6.x |
| Servidor | Apache Tomcat embebido | 10.x |
| DB | PostgreSQL | 15+ |
| Build backend | Maven | 3.x |
| Migraciones | Flyway (preferido) o Liquibase | — |
| DevOps | Docker + Docker Compose | opcional para dev |

**Puerto backend:** `8080`. **Frontend dev:** `5173` (Vite por defecto).

---

## 3. Estructura del repositorio (objetivo)

```
ERP-Max-Li/
├── backend/                    # Spring Boot
│   ├── src/main/java/com/maxli/
│   │   ├── MaxLiApplication.java
│   │   ├── config/             # Security, CORS, JWT, Beans
│   │   ├── controller/         # @RestController (uno por módulo)
│   │   ├── service/            # @Service (lógica de negocio)
│   │   ├── repository/         # JpaRepository
│   │   ├── entity/             # @Entity (mapeo BD)
│   │   ├── dto/                # Request/Response DTOs
│   │   ├── mapper/             # Entity ↔ DTO
│   │   ├── exception/          # @ControllerAdvice + custom exceptions
│   │   └── event/              # Application events (ej. StockAlarmEvent)
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   └── db/migration/       # Flyway: V1__init.sql, V2__...
│   └── pom.xml
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── pages/              # Rutas (POS, Inventario, Compras, ...)
│   │   ├── components/         # UI reutilizable
│   │   ├── api/                # apiClient.js + endpoints por módulo
│   │   ├── store/              # Zustand stores o contexts
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml          # postgres + backend + frontend (dev)
├── ArquitecturaCandidata3.pdf
├── README.md
└── CLAUDE.md                   # este archivo
```

Si el repo todavía está vacío, **partir de aquí**. Crear los dos proyectos (Spring Initializr para backend, `npm create vite@latest` para frontend) y commitear el scaffolding antes de cualquier feature.

---

## 4. Convenciones

### Backend (Java / Spring)

- **Paquetes:** `com.maxli.<modulo>.<capa>` (ej. `com.maxli.venta.service`).
- **Naming:** PascalCase clases, camelCase métodos/campos, UPPER_SNAKE_CASE constantes.
- **Capas estrictas:**
  - Controller → solo recibe HTTP, valida DTO, delega. **Cero lógica de negocio.**
  - Service → reglas de negocio. Anotado `@Service`. Métodos transaccionales con `@Transactional`.
  - Repository → solo acceso a datos. Extiende `JpaRepository`.
- **DTOs obligatorios** en la API. Nunca exponer `@Entity` directamente al frontend.
- **Excepciones:** lanzar excepciones de dominio (`StockInsuficienteException`, `OrdenNoRecepcionadaException`, etc.) y manejarlas en `@ControllerAdvice` global.
- **Auditoría:** usar Spring Data Auditing (`@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`) en entidades críticas.
- **Paginación:** todos los endpoints de listado reciben `Pageable` y devuelven `Page<DTO>`.
- **Validación:** `@Valid` + Bean Validation (`@NotNull`, `@Positive`, etc.) en DTOs.

### Frontend (React)

- **Naming:** PascalCase componentes, camelCase funciones/variables.
- **Una página = una ruta.** Páginas en `src/pages/`, componentes reutilizables en `src/components/`.
- **API client centralizado** en `src/api/apiClient.js` (Axios instance con interceptor JWT). Endpoints por módulo: `src/api/ventaApi.js`, `src/api/productoApi.js`, etc.
- **No fetch directo desde componentes.** Siempre pasar por la capa `api/`.
- **Estado:** local con `useState`/`useReducer`; global con Zustand (preferido por su simplicidad). Context API solo para cosas tipo `AuthContext` y tema.
- **Formularios:** React Hook Form + Zod para validación.

### Base de datos

- **Nomenclatura:** `snake_case` en tablas y columnas (`orden_compra`, `id_proveedor`).
- **PKs:** `BIGSERIAL` con nombre `id_<entidad>` (ej. `id_producto`).
- **FKs:** mismo nombre que la PK referenciada.
- **Estados:** columna `estado VARCHAR(20)` con valores en MAYÚSCULAS (`ACTIVO`, `INACTIVO`, `RECEPCIONADO`, etc.).
- **Migraciones Flyway:** `V<n>__<descripcion>.sql` (ej. `V1__init_schema.sql`, `V2__add_oferta_tables.sql`). Nunca editar una migración ya aplicada; crear una nueva.

### Git

- **Ramas:** `main` (estable), `develop` (integración), `feature/<modulo>-<descripcion>`, `fix/<descripcion>`.
- **Commits convencionales:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Ej.: `feat(venta): validar stock antes de confirmar venta`.
- **PRs:** describir qué regla de negocio toca el cambio y cómo se probó.

---

## Roadmap (Scrum, sprints de 2 sem comenzando 12may, a deadline 1-ago-2026)
 
Orden: **V1 sólido → V2 (requerido por DGII) → V3 si da tiempo.** No abrir épica nueva sin happy path + reglas críticas en verde de la anterior.
 
| Versión | Foco | Ventana |
|---|---|---|
| **V1 MVP** | Usuarios+roles, caja/turnos, productos+inventario, POS | hasta 23 jun |
| **V2** | Compras (3 vías) + NCF | 24 jun – 7 jul |
| **V3** | Ofertas + devoluciones/notas crédito | 8 jul – 21 jul |
| Buffer | Bugs + demo | 22 jul – 1 ago |
 
**Orden de implementación V1:** Usuarios/Roles (base auth) → Inventario/Productos → Caja/Turnos → Ventas/POS.

## 5. Roadmap por épicas

Las épicas vienen del tablero (V1 = MVP funcional, V2 = fiscal y compras, V3 = extras).

### Infraestructura

### V1 — MVP operativo (orden de implementación recomendado)

1. **V1-Gestión de Usuarios y Roles** — fundación. Sin login no se prueba nada con permisos reales.
   - Entidades: `Usuario`, `Rol`.
   - Endpoints: login (JWT), CRUD usuarios (solo ADMIN), refresh token.
   - Roles: `ADMIN`, `CAJERO`, `ALMACENERO`.
2. **V1-Gestión de Inventario y Productos** — sin productos no hay venta.
   - Entidades: `Producto`, `Categoria`, `Marca`, `Almacen`, `Existencia`, `Movimiento`, `DetalleMovimiento`.
   - Reglas: stock no negativo, stock alarma (evento), soft delete.
3. **V1-Gestión de Caja y Turnos** — sin caja abierta no se vende.
   - Entidades: `Caja`, `TurnoCaja`, `CajaChica`, `MovimientoCaja`.
   - Reglas: apertura con monto inicial, cierre con cálculo automático de ventas efectivo/tarjeta + diferencia declarada.
4. **V1-Gestión de Ventas y Clientes** — el corazón del POS.
   - Entidades: `Venta`, `DetalleVenta`, `Cliente`, `Ingreso`.
   - Reglas: atomicidad, validación de stock, descuento de inventario, asignación de NCF.

### V2 — Fiscal y compras

5. **V2-Gestión de Comprobantes Fiscales (NCF)**
   - Entidad: `SecuenciaNCF`.
   - Servicio thread-safe que entrega siguiente NCF dado un `nombre_tipo` (B01, B04, etc.).
   - Validación de vencimiento y `secuencia_fin`.
6. **V2-Gestión de Compras y Proveedores**
   - Entidades: `Proveedor`, `OrdenCompra`, `DetalleOrdenCompra`, `NotaRecepcion`, `DetalleNotaRecepcion`, `PagoProveedor`.
   - Reglas: 3 vías estricta.

### V3 — Extras comerciales

7. **V3-Gestión de Ofertas y Descuentos** — `Oferta`, `OfertaCantidad`, `OfertaDescuento`. Aplicar en POS automáticamente si la oferta está vigente y activa.
8. **V3-Gestión de Devoluciones y Notas de Crédito** — `Devolucion`, `DetalleDevolucion`, `NotaCredito`. Genera NCF tipo nota de crédito.

**Regla de oro:** no avanzar a la siguiente épica si la actual no tiene tests del happy path + reglas críticas pasando.

---

## 6. Mapa entidades ↔ tablas

Resumen (32 entidades / 32 tablas). Detalle completo en el PDF, sección 4 y 5.

| Grupo | Entidad (Java) | Tabla (SQL) |
|---|---|---|
| Seguridad | `Usuario`, `Rol` | `usuario`, `rol` |
| Caja | `Caja`, `TurnoCaja`, `CajaChica`, `MovimientoCaja` | `caja`, `turno_caja`, `caja_chica`, `movimiento_caja` |
| Catálogo | `Producto`, `Categoria`, `Marca` | `producto`, `categoria`, `marca` |
| Inventario | `Almacen`, `Existencia`, `Movimiento`, `DetalleMovimiento` | `almacen`, `existencia`, `movimiento`, `detalle_movimiento` |
| Ventas | `Venta`, `DetalleVenta`, `Cliente`, `Ingreso` | `venta`, `detalle_venta`, `cliente`, `ingreso` |
| Compras | `Proveedor`, `OrdenCompra`, `DetalleOrdenCompra`, `NotaRecepcion`, `DetalleNotaRecepcion`, `PagoProveedor` | `proveedor`, `orden_compra`, `detalle_orden_compra`, `nota_recepcion`, `detalle_nota_recepcion`, `pago_proveedor` |
| Devoluciones | `Devolucion`, `DetalleDevolucion`, `NotaCredito` | `devolucion`, `detalle_devolucion`, `nota_credito` |
| Ofertas | `Oferta`, `OfertaCantidad`, `OfertaDescuento` | `oferta`, `oferta_cantidad`, `oferta_descuento` |
| Fiscal | `SecuenciaNCF` | `secuencia_ncf` |

Índices obligatorios (desde el PDF):
- `producto.codigo` UNIQUE
- `existencia.id_producto` INDEX
- `venta(fecha, estado)` COMPOSITE
- `detalle_venta.id_venta` INDEX
- `movimiento.fecha` INDEX
- `orden_compra.estado` INDEX
- `secuencia_ncf.nombre_tipo` INDEX
- `usuario(username, estado)` COMPOSITE

---

## 7. Patrones aplicados (no inventar otros sin justificarlo)

| Patrón | Dónde |
|---|---|
| Repository | Spring Data `JpaRepository`. |
| DTO | Todo lo que cruza la API. |
| Service Layer | Lógica de negocio, una clase `@Service` por agregado. |
| Factory Method | Construcción de `Venta`/`OrdenCompra` con sus detalles en el service. |
| Observer / Event | `StockAlarmEvent` cuando `cantidadActual < cantidadMinima`. |
| Strategy | `PagoStrategy` con implementaciones efectivo/tarjeta/crédito. |
| Singleton | Beans de Spring por defecto. |
| Facade | `@RestController` simplifica el dominio al frontend. |

---

## 8. Setup local

### Prerrequisitos

- Java 21 LTS (Temurin recomendado)
- Maven 3.9+
- Node 20 LTS
- PostgreSQL 15+ (o Docker)
- Git

### Backend

```bash
cd backend
# Configurar application-dev.yml con credenciales de Postgres locales
./mvnw spring-boot:run
# Servidor: http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

### Docker Compose (opción rápida)

```bash
docker compose up -d
```

Levanta `postgres`, `backend`, `frontend` ya conectados.

### Variables de entorno

**Nunca commitear secrets.** Usar `.env` (gitignored) en frontend y `application-dev.yml` local en backend.

Variables esperadas:
- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (mínimo 256 bits)
- `JWT_EXPIRATION` (ms)
- `CORS_ALLOWED_ORIGINS` (lista, ej. `http://localhost:5173`)
- `VITE_API_BASE_URL` (frontend, ej. `http://localhost:8080/api`)

---

## 9. Testing (no negociable para features críticas)

### Backend

- **Unit tests:** JUnit 5 + Mockito para Services.
- **Integration tests:** `@SpringBootTest` + Testcontainers (Postgres) para flujos completos.
- **Mínimo obligatorio por épica:**
  - Happy path del use case principal.
  - Una prueba por cada regla de negocio crítica (las 7 del top).

Ejemplos de tests imprescindibles:
- `VentaServiceTest.no_permite_venta_sin_stock_suficiente()`
- `CuentaPorPagarServiceTest.rechaza_pago_si_orden_no_recepcionada()`
- `SecuenciaNCFServiceTest.asigna_secuencias_unicas_en_concurrencia()` (multi-thread)
- `ProductoServiceTest.eliminar_marca_estado_inactivo_no_borra_fisicamente()`

### Frontend

- **Vitest** + React Testing Library para componentes y hooks.
- E2E opcional con Playwright para el flujo POS.

Correr todo antes de PR:
```bash
# Backend
cd backend && ./mvnw test
# Frontend
cd frontend && npm test
```

---

## 10. Seguridad

- **JWT stateless.** El backend no guarda sesiones. Cada request lleva `Authorization: Bearer <token>`.
- **Bcrypt** para passwords (`spring-security-crypto`). Nunca guardar plano.
- **Autorización por rol** con `@PreAuthorize("hasRole('ADMIN')")` en endpoints sensibles.
- **CORS** restrictivo: solo el origen del frontend.
- **Validación de entrada** estricta en todos los DTOs.
- **Logs**: nunca loguear passwords, tokens, ni el contenido completo de NCF generados.
- **Variables de entorno** para todo lo sensible. `application.yml` solo defaults no-secretos.

---

## 11. Cosas que Claude NO debe hacer

- ❌ Añadir librerías sin justificación. Ya hay un stack definido.
- ❌ Migrar a microservicios. Es un monolito modular (sección 3.1 del PDF lo aclara: "Posibilidad de migración futura..." — futura, no ahora).
- ❌ Hacer `DELETE` físico en tablas maestras. Soft delete obligatorio.
- ❌ Poner lógica de negocio en Controllers.
- ❌ Exponer entidades JPA en endpoints. Siempre DTOs.
- ❌ Tocar `application.yml` para credenciales. Va en `application-dev.yml` (ignorado) o env vars.
- ❌ Saltarse `@Transactional` en operaciones multi-tabla.
- ❌ Generar NCF sin pasar por `SecuenciaNCFService`.
- ❌ Permitir `cantidad_actual < 0` en `existencia`. Hay un `CHECK >= 0` en la BD por algo.

---

## 12. Glosario (acrónimos)

- **NCF:** Número de Comprobante Fiscal (DGII República Dominicana).
- **POS:** Point of Sale (punto de venta).
- **3 vías:** Orden de compra ↔ Recepción ↔ Factura del proveedor. Todas deben coincidir para autorizar pago.
- **Stock Alarma:** Nivel mínimo de inventario que dispara alerta de reposición.
- **SPA:** Single Page Application.
- **HMR:** Hot Module Replacement.
- **ITBIS:** Impuesto sobre Transferencias de Bienes Industrializados y Servicios (18% RD).
- **RNC:** Registro Nacional del Contribuyente.

---

## 13. Próximos pasos sugeridos

Si el repo está vacío o casi vacío, el orden inicial es:

1. Scaffolding backend con Spring Initializr (deps: Web, Security, Data JPA, Validation, PostgreSQL Driver, Flyway, Lombok).
2. Scaffolding frontend con `npm create vite@latest frontend -- --template react`.
3. `docker-compose.yml` con Postgres.
4. `V1__init_schema.sql` con las 32 tablas (copiar del PDF).
5. Implementar épica **V1-Usuarios y Roles** completa (entidad + repo + service + controller + tests + UI de login).
6. Continuar con **V1-Inventario y Productos**.

**Antes de empezar a codear cada épica:** revisar la sección correspondiente del PDF y confirmar el modelo de datos contra `V1__init_schema.sql`.
