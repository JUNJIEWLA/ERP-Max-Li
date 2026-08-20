// ─────────────────────────────────────────────────────────
//  Servicio API centralizado — ERP Max Li
//  Todas las llamadas al backend pasan por aquí.
//  El proxy de Vite redirige /api/* → http://localhost:8080
// ─────────────────────────────────────────────────────────

// Vercel proxy (vercel.json) redirige /api/* → Render backend en producción.
// Vite proxy (vite.config.ts) redirige /api/* → localhost:8080 en desarrollo.
// Ambos mantienen el mismo origen para que las cookies y el CSRF funcionen.
const BASE_URL = '/api';

// ── Sesión ───────────────────────────────────────────────
//
//  El JWT vive en una cookie HttpOnly emitida por el backend: este código no
//  puede leerlo ni guardarlo, que es justamente el objetivo (un XSS ya no puede
//  robar la sesión). En consecuencia:
//    · toda petición viaja con `credentials: 'include'` para que el navegador
//      adjunte la cookie;
//    · quién es el usuario y qué permisos tiene se preguntan a /auth/me, no a
//      localStorage;
//    · las peticiones mutantes llevan el token CSRF que acompaña a la cookie.

export const AUTH_EXPIRED_EVENT = 'maxli-auth-expired';

/** Cookie legible por el SPA que Spring Security emite junto a la sesión. */
const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

function leerCookie(nombre: string): string | null {
  const encontrada = document.cookie
    .split('; ')
    .find(entrada => entrada.startsWith(`${nombre}=`));
  return encontrada ? decodeURIComponent(encontrada.slice(nombre.length + 1)) : null;
}

function expireSession(): void {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/** Cabeceras para peticiones que modifican estado. */
function csrfHeaders(): HeadersInit {
  const token = leerCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

// ── Tipos genéricos ──────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/**
 * Error de una respuesta HTTP, con el código que la produjo.
 *
 * Sigue siendo un `Error` con el mensaje del backend en `.message`, así que
 * todo el código que solo lee `e.message` no cambia; quien necesita distinguir
 * un 409 (operación ya registrada) de un 422 (regla de negocio) lee `.status`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function buildErrorMessage(res: Response): Promise<string> {
  const fallback = `Error ${res.status}: ${res.statusText || 'Error'}`;

  // Un 401 en /auth/login es "credenciales incorrectas", no "sesión expirada":
  // ese caso lo trata authApi.login y aquí solo se propaga el mensaje del backend.
  if (res.status === 401 && !res.url.includes('/auth/login')) {
    expireSession();
    return 'Tu sesión expiró. Inicia sesión nuevamente.';
  }

  if (res.status === 429) {
    const espera = res.headers.get('Retry-After');
    return espera
      ? `Demasiados intentos. Vuelve a intentarlo en ${espera} segundos.`
      : 'Demasiados intentos. Vuelve a intentarlo más tarde.';
  }

  if (res.status === 403) {
    return 'No tienes permisos para realizar esta acción.';
  }

  const contentType = res.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = await res.json();
      if (typeof body?.error === 'string') return body.error;
      if (typeof body?.message === 'string') return body.message;
      if (body?.errors && typeof body.errors === 'object') {
        return Object.values(body.errors).filter(Boolean).join('. ');
      }
    } else {
      const text = await res.text();
      const message = text.trim();
      if (message === 'Internal Server Error') {
        return 'El backend no está disponible. Verifica que Spring Boot esté corriendo en el puerto 8080.';
      }
      if (message) return message;
    }
  } catch {
    // Mantener el fallback si el backend no devuelve un body parseable.
  }

  return fallback;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, await buildErrorMessage(res));
  return res.json();
}

async function post<T>(url: string, data: any): Promise<T> {
  const res = await fetch(BASE_URL + url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify(data),
  });
  // /auth/login returning 401 = wrong credentials, NOT an expired session.
  // Only dispatch AUTH_EXPIRED_EVENT for protected endpoints.
  if (res.status === 401 && !url.includes('/auth/login')) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(401, 'Sesión expirada');
  }
  if (!res.ok) throw new ApiError(res.status, await buildErrorMessage(res));
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}


async function put<T>(url: string, data: any): Promise<T> {
  const res = await fetch(BASE_URL + url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify(data),
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(401, 'Sesión expirada');
  }
  if (!res.ok) throw new ApiError(res.status, await buildErrorMessage(res));
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE_URL + path, {
    method: 'DELETE',
    credentials: 'include',
    headers: csrfHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, await buildErrorMessage(res));
}

// ── API: Auth ────────────────────────────────────────────

/** Respuesta del login. Ya no trae `token`: el JWT queda en la cookie HttpOnly. */
export interface AuthResponse {
  username: string;
  email: string;
  roles: string[];
  permisos: string[];
  expiresIn: number;
  requiereCambioPassword: boolean;
}

export interface MeResponse {
  username: string;
  email: string;
  permisos: string[];
  roles: string[];
  tokenVersion: number;
  requiereCambioPassword: boolean;
}

export const authApi = {
  login: (username: string, password: string) =>
    // No pasa por el helper `post` para que un 401 se lea como "credenciales
    // incorrectas" y no dispare el evento de sesión expirada.
    fetch(BASE_URL + '/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async res => {
      if (!res.ok) throw new ApiError(res.status, await buildErrorMessage(res));
      return res.json() as Promise<AuthResponse>;
    }),

  /** Borra la cookie de sesión en el servidor: el cliente no puede tocarla. */
  logout: () => post<void>('/auth/logout', {}),

  cambiarPassword: (passwordActual: string, passwordNueva: string) =>
    post<void>('/auth/cambiar-password', { passwordActual, passwordNueva }),

  me: () => get<MeResponse>('/auth/me'),

  /**
   * Recupera la sesión al cargar la aplicación. Con el token fuera del alcance
   * del script, la única forma de saber si hay sesión viva es preguntárselo al
   * backend; `null` significa que no la hay.
   */
  recuperarSesion: async (): Promise<MeResponse | null> => {
    try {
      return await get<MeResponse>('/auth/me');
    } catch {
      return null;
    }
  },
};

// ── Tipos del dominio ────────────────────────────────────

export interface Producto {
  idProducto: number;
  sku: string;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string;
  precioVenta: number;
  precioVentaMayor: number;
  costo: number;
  tasaItbis: number;
  cantidadMinimaMayor: number;
  stockMinimo?: number;
  estado: string;
  idCategoria: number;
  categoriaNombre: string;
  porcentajeMargenCategoria: number;
  porcentajeMargenMayorCategoria: number;
  idMarca: number;
  marcaNombre: string;
  stockTotal?: number;
  fechaCreacion: string;
  fechaModificacion: string;
}

export type OfertaTipo = 'CANTIDAD' | 'DESCUENTO';

export interface Oferta {
  idOferta: number;
  nombre: string;
  descripcion: string | null;
  tipo: OfertaTipo;
  idProducto: number;
  productoSku: string;
  productoNombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  estado: string;
  cantidadRequerida: number | null;
  cantidadPagada: number | null;
  porcentajeDescuento: number | null;
  vigente: boolean;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface OfertaPayload {
  nombre: string;
  descripcion?: string | null;
  tipo: OfertaTipo;
  idProducto: number;
  fechaInicio: string;
  fechaFin?: string | null;
  estado?: string;
  cantidadRequerida?: number | null;
  cantidadPagada?: number | null;
  porcentajeDescuento?: number | null;
}

export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string;
  estado: string;
  porcentajeMargen: number;
  porcentajeMargenMayor: number;
}

export interface HistorialCosto {
  idHistorialCosto: number;
  idProducto: number;
  nombreProducto: string;
  nombreProveedor: string;
  costoAnterior: number;
  costoNuevo: number;
  variacionPorcentaje: number;
  cantidadRecibida: number;
  fechaRegistro: string;
}

export interface AlertaCosto {
  idAlertaCosto: number;
  idProducto: number;
  nombreProducto: string;
  costoAnterior: number;
  costoNuevo: number;
  precioVentaActual: number;
  precioVentaSugerido: number;
  precioVentaMayorActual: number;
  precioVentaMayorSugerido: number;
  porcentajeVariacion: number;
  porcentajeMargen: number;
  porcentajeMargenMayor: number;
  estado: string;
  fechaCreacion: string;
  fechaResolucion: string | null;
}

export interface Almacen {
  idAlmacen: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface Marca {
  idMarca: number;
  nombre: string;
  descripcion: string;
  estado: string;
}

export interface Existencia {
  idExistencia: number;
  idProducto: number;
  productoCodigo: string;
  productoNombre: string;
  productoEstado: string;
  idAlmacen: number;
  almacenNombre: string;
  cantidadActual: number;
  cantidadMinima: number;
  bajoPuntoReorden: boolean;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface Permiso {
  idPermiso: number;
  nombreClave: string;
  descripcion: string;
  modulo: string;
}

export interface Rol {
  idRol: number;
  nombre: string;
  descripcion: string;
  permisos: Permiso[];
}

export interface Usuario {
  idUsuario: number;
  username: string;
  email: string;
  estado: string;
  requiereCambioPassword: boolean;
  roles: string[];
  rolIds: number[];
  permisoExtraIds: number[];
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface Caja {
  idCaja: number;
  nombre: string;
  estado: string;
  idAlmacen: number | null;
  almacenNombre: string | null;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface CajaChica {
  idCajaChica: number;
  nombre: string;
  responsable: string;
  saldoActual: number;
  limiteMonto: number;
  estado: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

export type TipoMovimientoCaja = 'INGRESO' | 'EGRESO';

export interface MovimientoCaja {
  idMovimiento: number;
  idCajaChica: number;
  cajaChicaNombre: string;
  tipoMovimiento: TipoMovimientoCaja;
  fechaHora: string;
  monto: number;
  concepto: string;
  idUsuario: number;
  username: string;
  saldoActualCajaChica: number;
}

export interface TurnoCaja {
  idTurnoCaja: number;
  idCaja: number;
  cajaNombre: string;
  idAlmacen: number | null;
  almacenNombre: string | null;
  idUsuarioApertura: number;
  usernameUsuarioApertura: string;
  idUsuarioCierre: number | null;
  usernameUsuarioCierre: string | null;
  montoInicial: number;
  montoFinalDeclarado: number | null;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasTransferencia: number;
  totalVentasNotaCredito?: number;
  totalOtrosIngresos: number;
  totalEgresos: number;
  montoEsperado: number;
  diferencia: number | null;
  estado: string;
  observacionApertura: string | null;
  observacionCierre: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  fechaModificacion: string | null;
}

export interface CuadreTurnoCaja {
  idTurnoCaja: number;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasTransferencia: number;
  totalOtrosIngresos: number;
  totalEgresos: number;
  /** Efectivo devuelto por notas de crédito durante el turno. Resta del cajón. */
  totalDevolucionesEfectivo: number;
  totalVentasNotaCredito?: number;
  montoEsperado: number;
  montoFinalDeclarado: number | null;
  diferencia: number | null;
  calculadoEn: string;
}

// ── API: Productos ───────────────────────────────────────

export const productosApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Producto>>('/productos', { page, size }),

  listarActivos: (page = 0, size = 20) =>
    get<PageResponse<Producto>>('/productos/activos', { page, size }),

  buscarPorId: (id: number) =>
    get<Producto>(`/productos/${id}`),

  buscarPorCodigo: (codigo: string) =>
    get<Producto>(`/productos/codigo/${codigo}`),

  /** Búsqueda rápida para el POS por código de barras, SKU o nombre. */
  buscarParaPOS: (q: string) =>
    get<Producto[]>(`/productos/buscar`, { q }),


  crear: (body: Omit<Producto, 'idProducto' | 'fechaCreacion' | 'fechaModificacion' | 'categoriaNombre' | 'marcaNombre'>) =>
    post<Producto>('/productos', body),

  actualizar: (id: number, body: Partial<Producto>) =>
    put<Producto>(`/productos/${id}`, body),

  desactivar: (id: number) =>
    del(`/productos/${id}`),
};

// ── API: Ofertas ─────────────────────────────────────────

export const ofertasApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Oferta>>('/ofertas', { page, size, sort: 'idOferta,desc' }),

  listarActivas: (page = 0, size = 20) =>
    get<PageResponse<Oferta>>('/ofertas/activas', { page, size, sort: 'idOferta,desc' }),

  listarVigentes: (page = 0, size = 20) =>
    get<PageResponse<Oferta>>('/ofertas/vigentes', { page, size, sort: 'idOferta,desc' }),

  listarPorTipo: (tipo: OfertaTipo, page = 0, size = 20) =>
    get<PageResponse<Oferta>>(`/ofertas/tipo/${tipo}`, { page, size, sort: 'idOferta,desc' }),

  listarPorProducto: (idProducto: number, page = 0, size = 20) =>
    get<PageResponse<Oferta>>(`/ofertas/producto/${idProducto}`, { page, size, sort: 'idOferta,desc' }),

  listarVigentesPorProducto: (idProducto: number) =>
    get<Oferta[]>(`/ofertas/producto/${idProducto}/vigentes`),

  buscarPorId: (id: number) =>
    get<Oferta>(`/ofertas/${id}`),

  crear: (body: OfertaPayload) =>
    post<Oferta>('/ofertas', body),

  actualizar: (id: number, body: OfertaPayload) =>
    put<Oferta>(`/ofertas/${id}`, body),

  desactivar: (id: number) =>
    del(`/ofertas/${id}`),
};

// ── API: Categorías ──────────────────────────────────────

export const categoriasApi = {
  listar: (page = 0, size = 100) =>
    get<PageResponse<Categoria>>('/categorias', { page, size }),

  listarActivas: () =>
    get<PageResponse<Categoria>>('/categorias/activas', { page: 0, size: 100 }),

  crear: (body: { nombre: string; descripcion?: string; porcentajeMargen?: number; porcentajeMargenMayor?: number }) =>
    post<Categoria>('/categorias', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; estado?: string; porcentajeMargen?: number; porcentajeMargenMayor?: number }) =>
    put<Categoria>(`/categorias/${id}`, body),

  desactivar: (id: number) =>
    del(`/categorias/${id}`),
};

// ── API: Almacenes ───────────────────────────────────────

export const almacenesApi = {
  listar: (page = 0, size = 10) =>
    get<PageResponse<Almacen>>('/almacenes', { page, size, sort: 'nombre,asc' }),

  crear: (body: { nombre: string; descripcion?: string; estado: string }) =>
    post<Almacen>('/almacenes', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; estado: string }) =>
    put<Almacen>(`/almacenes/${id}`, body),

  desactivar: (id: number) =>
    del(`/almacenes/${id}`),
};

// ── API: Marcas ──────────────────────────────────────────

export const marcasApi = {
  listar: (page = 0, size = 100) =>
    get<PageResponse<Marca>>('/marcas', { page, size }),

  listarActivas: () =>
    get<PageResponse<Marca>>('/marcas/activas', { page: 0, size: 100 }),

  crear: (body: { nombre: string; descripcion?: string }) =>
    post<Marca>('/marcas', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; estado?: string }) =>
    put<Marca>(`/marcas/${id}`, body),

  desactivar: (id: number) =>
    del(`/marcas/${id}`),
};

// ── API: Existencias ─────────────────────────────────────

export const existenciasApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Existencia>>('/existencias', { page, size }),

  listarPorAlmacen: (idAlmacen: number, page = 0, size = 20) =>
    get<PageResponse<Existencia>>(`/existencias/almacen/${idAlmacen}`, { page, size }),

  bajoStock: (page = 0, size = 20) =>
    get<PageResponse<Existencia>>('/existencias/bajo-stock', { page, size }),

  bajoStockPorAlmacen: (idAlmacen: number, page = 0, size = 20) =>
    get<PageResponse<Existencia>>(`/existencias/almacen/${idAlmacen}/bajo-stock`, { page, size }),

  buscarPorProducto: (idProducto: number) =>
    get<Existencia[]>(`/existencias/producto/${idProducto}`),

  crear: (body: { idProducto: number; idAlmacen: number; cantidadActual: number; cantidadMinima: number }) =>
    post<Existencia>('/existencias', body),

  actualizar: (id: number, body: { deltaCantidadActual: number; cantidadMinima: number }) =>
    put<Existencia>(`/existencias/${id}`, body),
};

// ── Tipos: Movimientos de Inventario ─────────────────────

export interface DetalleMovimientoInventario {
  idDetalleMovimiento: number;
  idProducto: number;
  productoNombre: string;
  productoSku: string;
  cantidad: number;
  cantidadAnteriorOrigen: number | null;
  cantidadPosteriorOrigen: number | null;
  cantidadAnteriorDestino: number | null;
  cantidadPosteriorDestino: number | null;
}

export interface MovimientoInventario {
  idMovimiento: number;
  tipo: string;
  idAlmacenOrigen: number | null;
  almacenOrigenNombre: string | null;
  idAlmacenDestino: number | null;
  almacenDestinoNombre: string | null;
  referencia: string | null;
  observacion: string | null;
  estado: string;
  usuarioResponsable: string;
  fechaMovimiento: string;
  detalles: DetalleMovimientoInventario[];
  fechaCreacion: string;
  fechaModificacion: string;
}

// ── API: Movimientos de Inventario ───────────────────────

export const movimientosApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<MovimientoInventario>>('/movimientos', { page, size, sort: 'idMovimiento,desc' }),

  buscarPorId: (id: number) =>
    get<MovimientoInventario>(`/movimientos/${id}`),

  listarPorAlmacen: (idAlmacen: number, page = 0, size = 20) =>
    get<PageResponse<MovimientoInventario>>(`/movimientos/almacen/${idAlmacen}`, { page, size }),

  listarPorTipo: (tipo: string, page = 0, size = 20) =>
    get<PageResponse<MovimientoInventario>>(`/movimientos/tipo/${tipo}`, { page, size }),

  crearTransferencia: (body: {
    idAlmacenOrigen: number;
    idAlmacenDestino: number;
    referencia?: string;
    observacion?: string;
    detalles: { idProducto: number; cantidad: number }[];
  }) => post<MovimientoInventario>('/movimientos/transferencia', body),
};

// ── API: Permisos ────────────────────────────────────────

export const permisosApi = {
  listar: () => get<Permiso[]>('/roles/permisos'),
};

// ── API: Roles ───────────────────────────────────────────

export const rolesApi = {
  listar: (page = 0, size = 50) =>
    get<PageResponse<Rol>>('/roles', { page, size }),

  listarTodos: () =>
    get<Rol[]>('/roles/todos'),

  buscarPorId: (id: number) =>
    get<Rol>(`/roles/${id}`),

  crear: (body: { nombre: string; descripcion?: string; permisoIds?: number[] }) =>
    post<Rol>('/roles', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; permisoIds?: number[] }) =>
    put<Rol>(`/roles/${id}`, body),

  eliminar: (id: number) =>
    del(`/roles/${id}`),
};

// ── API: Usuarios ────────────────────────────────────────

export const usuariosApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Usuario>>('/usuarios', { page, size }),

  listarActivos: (page = 0, size = 20) =>
    get<PageResponse<Usuario>>('/usuarios/activos', { page, size }),

  buscarPorId: (id: number) =>
    get<Usuario>(`/usuarios/${id}`),

  crear: (body: { username: string; email: string; password?: string; estado?: string; rolIds?: number[]; permisoExtraIds?: number[] }) =>
    post<Usuario>('/usuarios', body),

  actualizar: (id: number, body: { username: string; email: string; password?: string; estado?: string; rolIds?: number[]; permisoExtraIds?: number[] }) =>
    put<Usuario>(`/usuarios/${id}`, body),

  desactivar: (id: number) =>
    del(`/usuarios/${id}`),

  resetearPassword: (id: number, passwordNueva: string) =>
    put<void>(`/usuarios/${id}/reset-password`, { password: passwordNueva }),

  asignarRol: (idUsuario: number, idRol: number) =>
    post<Usuario>(`/usuarios/${idUsuario}/roles/${idRol}`, {}),

  quitarRol: (idUsuario: number, idRol: number) =>
    del(`/usuarios/${idUsuario}/roles/${idRol}`),
};

// ── API: Cajas y Turnos ──────────────────────────────────

export const cajasApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Caja>>('/cajas', { page, size }),

  listarActivas: (page = 0, size = 100) =>
    get<PageResponse<Caja>>('/cajas/activas', { page, size }),

  buscarPorId: (id: number) =>
    get<Caja>(`/cajas/${id}`),

  crear: (body: { nombre: string; estado?: string; idAlmacen: number }) =>
    post<Caja>('/cajas', body),

  actualizar: (id: number, body: { nombre: string; estado?: string; idAlmacen: number }) =>
    put<Caja>(`/cajas/${id}`, body),

  desactivar: (id: number) =>
    del(`/cajas/${id}`),
};

export const cajasChicasApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<CajaChica>>('/cajas/chicas', { page, size }),

  listarActivas: (page = 0, size = 100) =>
    get<PageResponse<CajaChica>>('/cajas/chicas/activas', { page, size }),

  buscarPorId: (id: number) =>
    get<CajaChica>(`/cajas/chicas/${id}`),

  crear: (body: { nombre: string; responsable: string; saldoActual: number; limiteMonto: number; estado?: string }) =>
    post<CajaChica>('/cajas/chicas', body),

  actualizar: (id: number, body: { nombre: string; responsable: string; saldoActual: number; limiteMonto: number; estado?: string }) =>
    put<CajaChica>(`/cajas/chicas/${id}`, body),

  desactivar: (id: number) =>
    del(`/cajas/chicas/${id}`),
};

export const movimientosCajaApi = {
  listarPorCajaChica: (idCajaChica: number, page = 0, size = 20) =>
    get<PageResponse<MovimientoCaja>>(`/cajas/chicas/${idCajaChica}/movimientos`, { page, size, sort: 'idMovimiento,desc' }),

  buscarPorId: (idMovimiento: number) =>
    get<MovimientoCaja>(`/cajas/chicas/movimientos/${idMovimiento}`),

  registrar: (idCajaChica: number, body: { tipoMovimiento: TipoMovimientoCaja; monto: number; concepto: string }) =>
    post<MovimientoCaja>(`/cajas/chicas/${idCajaChica}/movimientos`, body),
};

export const turnosCajaApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<TurnoCaja>>('/cajas/turnos', { page, size, sort: 'idTurnoCaja,desc' }),

  listarAbiertos: (page = 0, size = 20) =>
    get<PageResponse<TurnoCaja>>('/cajas/turnos/abiertos', { page, size }),

  buscarPorId: (id: number) =>
    get<TurnoCaja>(`/cajas/turnos/${id}`),

  buscarAbiertoPorCaja: (idCaja: number) =>
    get<TurnoCaja>(`/cajas/turnos/caja/${idCaja}/abierto`),

  abiertoActual: () =>
    get<TurnoCaja>('/cajas/turnos/actual/abierto'),

  calcularCuadre: (id: number) =>
    get<CuadreTurnoCaja>(`/cajas/turnos/${id}/cuadre`),

  abrir: (body: { idCaja: number; idUsuario?: number; montoInicial: number; observacionApertura?: string }) =>
    post<TurnoCaja>('/cajas/turnos/abrir', body),

  cerrar: (id: number, body: { montoFinalDeclarado: number; observacionCierre?: string }) =>
    post<TurnoCaja>(`/cajas/turnos/${id}/cerrar`, body),
};

// ── Tipos: Módulo de Compras ─────────────────────────────

export interface Proveedor {
  idProveedor: number;
  nombreEmpresa: string;
  rnc: string;
  ubicacion: string | null;
  vendedor: string | null;
  telefono: string | null;
  email: string | null;
  estado: string;
  balancePendiente: number;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface DetalleOrdenCompra {
  idDetalleOrdenCompra: number;
  idProducto: number;
  nombreProducto: string;
  skuProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  cantidadRecibida: number;
  cantidadPendiente: number;
  idAlmacen: number | null;
  nombreAlmacen: string | null;
}

export interface OrdenCompra {
  idOrdenCompra: number;
  idProveedor: number;
  nombreProveedor: string;
  total: number;
  /** Monto realmente recibido si la orden se cerró con faltantes; null si llegó completa. */
  totalRecepcionado: number | null;
  estado: string;
  detalles: DetalleOrdenCompra[];
  /** Fecha acordada con el proveedor (ISO date string o null si no se configuró). */
  fechaLlegadaAcordada: string | null;
  /**
   * Días de retraso calculados por el backend.
   * null = no hay fecha acordada, o la OC ya está completada, o la fecha aún no venció.
   * 0 = venció hoy. > 0 = hay retraso.
   */
  diasRetraso: number | null;
  fechaOrden: string;
  fechaModificacion: string;
}

export interface DetalleNotaRecepcion {
  idDetalleNotaRecepcion: number;
  idDetalleOrdenCompra: number;
  idProducto: number;
  nombreProducto: string;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  observacion: string;
  notas: string | null;
  idAlmacen: number | null;
  nombreAlmacen: string | null;
}

export interface NotaRecepcion {
  idNotaRecepcion: number;
  idOrdenCompra: number;
  estado: string;
  detalles: DetalleNotaRecepcion[];
  fechaRecepcion: string;
  fechaModificacion: string;
}

// ── API: Proveedores ─────────────────────────────────────

export const proveedoresApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Proveedor>>('/proveedores', { page, size }),

  listarActivos: (page = 0, size = 100) =>
    get<PageResponse<Proveedor>>('/proveedores/activos', { page, size }),

  buscarPorId: (id: number) =>
    get<Proveedor>(`/proveedores/${id}`),

  crear: (body: Omit<Proveedor, 'idProveedor' | 'balancePendiente' | 'fechaCreacion' | 'fechaModificacion'>) =>
    post<Proveedor>('/proveedores', body),

  actualizar: (id: number, body: Partial<Proveedor>) =>
    put<Proveedor>(`/proveedores/${id}`, body),

  desactivar: (id: number) =>
    del(`/proveedores/${id}`),
};

// ── API: Órdenes de Compra ───────────────────────────────

export const ordenesCompraApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<OrdenCompra>>('/ordenes-compra', { page, size, sort: 'idOrdenCompra,desc' }),

  listarPorProveedor: (idProveedor: number, page = 0, size = 20) =>
    get<PageResponse<OrdenCompra>>(`/ordenes-compra/proveedor/${idProveedor}`, { page, size }),

  buscarPorId: (id: number) =>
    get<OrdenCompra>(`/ordenes-compra/${id}`),

  crear: (body: {
    idProveedor: number;
    fechaLlegadaAcordada?: string | null;
    detalles: { idProducto: number; cantidad: number; precioUnitario: number; idAlmacen?: number | null }[]
  }) =>
    post<OrdenCompra>('/ordenes-compra', body),

  enviar: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/enviar`, {}),

  anular: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/anular`, {}),

  forzarCierre: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/forzar-cierre`, {}),

};

// ── API: Gastos ─────────────────────────────────────────

export interface Gasto {
  idGasto: number;
  idOrdenCompra: number;
  nombreProveedor: string;
  monto: number;
  estado: 'PENDIENTE' | 'REALIZADO';
  fechaRegistro: string;
  fechaRealizado: string | null;
}

export interface OrdenCompraDisponible {
  idOrdenCompra: number;
  nombreProveedor: string;
  total: number;
}

export const gastosApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Gasto>>('/gastos', { page, size, sort: 'idGasto,desc' }),

  listarOrdenesDisponibles: () =>
    get<OrdenCompraDisponible[]>('/gastos/ordenes-disponibles'),

  crear: (idOrdenCompra: number) =>
    post<Gasto>('/gastos', { idOrdenCompra }),

  marcarComoRealizado: (idGasto: number) =>
    put<Gasto>(`/gastos/${idGasto}/marcar-realizado`, {}),
};

// ── API: Notas de Recepción ──────────────────────────────

export const notasRecepcionApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<NotaRecepcion>>('/notas-recepcion', { page, size, sort: 'idNotaRecepcion,desc' }),

  listarPorOrden: (idOrden: number, page = 0, size = 20) =>
    get<PageResponse<NotaRecepcion>>(`/notas-recepcion/orden/${idOrden}`, { page, size }),

  buscarPorId: (id: number) =>
    get<NotaRecepcion>(`/notas-recepcion/${id}`),

  crear: (body: { idOrdenCompra: number; detalles: { idDetalleOrdenCompra: number; cantidadRecibida: number; observacion: string; notas?: string; idAlmacen: number }[] }) =>
    post<NotaRecepcion>('/notas-recepcion', body),

  confirmar: (id: number) =>
    put<NotaRecepcion>(`/notas-recepcion/${id}/confirmar`, {}),

  rechazar: (id: number) =>
    put<NotaRecepcion>(`/notas-recepcion/${id}/rechazar`, {}),
};

// ── Tipos: Módulo de Clientes ────────────────────────────

export interface Cliente {
  idCliente: number;
  nombreCompleto: string;
  rncCedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tipoNcfPreferido: string;
  descuentoPredeterminado: number;
  totalCompras: number;
  estado: string;
  /** Días de plazo de crédito (0 = sin crédito). */
  diasCredito: number;
  /** Monto máximo de crédito en DOP (0 = sin crédito). */
  montoLimiteCredito: number;
  /** Estado calculado por el backend: SIN_CREDITO | AL_DIA | BLOQUEADO. */
  estadoCredito: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

/** DTO ligero retornado por el endpoint de búsqueda del POS. */
export interface ClienteResumen {
  idCliente: number;
  nombreCompleto: string;
  rncCedula: string | null;
  tipoNcfPreferido: string;
  descuentoPredeterminado: number;
}

// ── API: Clientes ────────────────────────────────────────

export const clientesApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Cliente>>('/clientes', { page, size }),

  listarActivos: (page = 0, size = 20) =>
    get<PageResponse<Cliente>>('/clientes/activos', { page, size }),

  buscarPorId: (id: number) =>
    get<Cliente>(`/clientes/${id}`),

  /** Lista todos los clientes activos en orden alfabético (sin paginación) para el selector del POS. */
  listarParaPOS: () =>
    get<ClienteResumen[]>('/clientes/pos'),

  /** Búsqueda rápida para el selector del POS. Retorna máx. 20 clientes activos. */
  buscarParaPOS: (q: string) =>
    get<ClienteResumen[]>(`/clientes/buscar`, { q }),

  crear: (body: {
    nombreCompleto: string;
    rncCedula?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    tipoNcfPreferido?: string;
    descuentoPredeterminado?: number;
    estado?: string;
    diasCredito?: number;
    montoLimiteCredito?: number;
  }) => post<Cliente>('/clientes', body),

  actualizar: (id: number, body: Partial<{
    nombreCompleto: string;
    rncCedula: string;
    telefono: string;
    email: string;
    direccion: string;
    tipoNcfPreferido: string;
    descuentoPredeterminado: number;
    estado: string;
    diasCredito: number;
    montoLimiteCredito: number;
  }>) => put<Cliente>(`/clientes/${id}`, body),

  desactivar: (id: number) =>
    del(`/clientes/${id}`),
};

// ── Tipos: Alertas de Retraso en Órdenes de Compra ───────────────

export interface AlertaRetrasoOc {
  idAlertaRetraso: number;
  idOrdenCompra: number;
  nombreProveedor: string;
  fechaLlegadaAcordada: string;
  /** Días transcurridos desde la fecha acordada (>= 0). */
  diasRetraso: number;
  /** PENDIENTE | LEIDA */
  estado: string;
  fechaCreacion: string;
  fechaModificacion: string | null;
}

// ── API: Alertas de Retraso OC ───────────────────────────────────

export const alertasRetrasoOcApi = {
  listarPendientes: (page = 0, size = 50) =>
    get<PageResponse<AlertaRetrasoOc>>('/alertas-retraso-oc', { page, size }),

  contarPendientes: () =>
    get<{ count: number }>('/alertas-retraso-oc/pendientes/count'),

  marcarLeidasMasivo: (ids: number[]) =>
    fetch('/api/alertas-retraso-oc/marcar-leidas', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ ids }),
    }).then(res => { if (!res.ok && res.status !== 204) throw new Error('Error al marcar alertas'); }),
};

// ── API: Historial de Costos ─────────────────────────────────────

export const historialCostosApi = {
  listarPorProducto: (idProducto: number, page = 0, size = 20) =>
    get<PageResponse<HistorialCosto>>(`/productos/${idProducto}/historial-costos`, { page, size }),
};

// ── API: Alertas de Costo (Buzón) ────────────────────────

export const alertasCostoApi = {
  listarPendientes: (page = 0, size = 50) =>
    get<PageResponse<AlertaCosto>>('/alertas-costo', { page, size }),

  contarPendientes: () =>
    get<{ count: number }>('/alertas-costo/pendientes/count'),

  aplicarMasivo: (ids: number[]) =>
    put<AlertaCosto[]>('/alertas-costo/aplicar-masivo', { ids }),

  descartarMasivo: (ids: number[]) =>
    put<AlertaCosto[]>('/alertas-costo/descartar-masivo', { ids }),
};

// ── Tipos: Módulo de Conteo Físico ───────────────────────

export interface ConteoDetalle {
  idConteoDetalle: number;
  idProducto: number;
  productoNombre: string;
  productoSku: string;
  productoCodigoBarras: string | null;
  cantidadFisica: number;
  cantidadSistema: number | null;
  diferencia: number | null;
  fechaRegistro: string;
}

export interface ConteoCabecera {
  idConteo: number;
  idAlmacen: number;
  almacenNombre: string;
  zona: string | null;
  estado: string;
  idUsuarioAsignado: number;
  usernameAsignado: string;
  idUsuarioSupervisor: number | null;
  usernameSupervisor: string | null;
  observacion: string | null;
  fechaAplicacion: string | null;
  fechaCreacion: string;
  fechaModificacion: string;
  detalles: ConteoDetalle[];
}

export interface ConteoResumen {
  idConteo: number;
  almacenNombre: string;
  zona: string | null;
  estado: string;
  usernameAsignado: string;
  usernameSupervisor: string | null;
  observacion: string | null;
  totalItems: number;
  totalDiscrepancias: number;
  fechaCreacion: string;
  fechaAplicacion: string | null;
}

// ── API: Conteo Físico ───────────────────────────────────

export const conteosApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<ConteoResumen>>('/conteos', { page, size }),

  buscarPorId: (id: number) =>
    get<ConteoCabecera>(`/conteos/${id}`),

  listarPorEstado: (estado: string, page = 0, size = 20) =>
    get<PageResponse<ConteoResumen>>(`/conteos/estado/${estado}`, { page, size }),

  listarPorUsuario: (idUsuario: number, page = 0, size = 20) =>
    get<PageResponse<ConteoResumen>>(`/conteos/usuario/${idUsuario}`, { page, size }),

  crear: (body: { idAlmacen: number; zona?: string; idUsuarioAsignado: number; observacion?: string }) =>
    post<ConteoCabecera>('/conteos', body),

  registrarLineas: (id: number, lineas: { idProducto: number; cantidadFisica: number }[]) =>
    post<ConteoCabecera>(`/conteos/${id}/lineas`, { lineas }),

  enviarARevision: (id: number) =>
    put<ConteoCabecera>(`/conteos/${id}/revision`, {}),

  aplicar: (id: number) =>
    put<ConteoCabecera>(`/conteos/${id}/aplicar`, {}),

  anular: (id: number) =>
    put<ConteoCabecera>(`/conteos/${id}/anular`, {}),
};

// ── Tipos: NCF ───────────────────────────────────────────

export interface ResolucionNcf {
  idResolucion: number;
  tipoNcf: string;
  descripcion: string;
  numeroResolucion: string;
  prefijo: string;
  secuenciaInicio: number;
  secuenciaFinal: number;
  secuenciaActual: number;
  fechaVencimiento: string;
  estado: string;
  fechaCreacion: string;
}

export interface ResolucionNcfPayload {
  tipoNcf: string;
  descripcion: string;
  numeroResolucion: string;
  prefijo: string;
  secuenciaInicio: number;
  secuenciaFinal: number;
  fechaVencimiento: string;
}

// ── API: NCF ─────────────────────────────────────────────

export const ncfApi = {
  listar: () =>
    get<ResolucionNcf[]>('/ncf'),

  crear: (body: ResolucionNcfPayload) =>
    post<ResolucionNcf>('/ncf', body),

  actualizar: (id: number, body: Omit<ResolucionNcfPayload, 'tipoNcf' | 'prefijo' | 'secuenciaInicio'> & Pick<ResolucionNcfPayload, 'tipoNcf' | 'prefijo' | 'secuenciaInicio'>) =>
    put<ResolucionNcf>(`/ncf/${id}`, body),

  /** Previsualiza el próximo NCF sin consumirlo. Retorna el número que se usaría en la próxima venta. */
  preview: (tipoNcf: string) =>
    get<{ ncfCompleto: string; idResolucion: number | null; fechaVencimiento: string | null }>(`/ncf/preview/${tipoNcf}`),
};


// ── Tipos: Cupones ───────────────────────────────────────

export type TipoDescuentoCupon = 'MONTO_FIJO' | 'PORCENTAJE';

export interface CategoriaSimple {
  idCategoria: number;
  nombre: string;
}

export interface Cupon {
  idCupon: number;
  codigoInterno: string;
  codigoSecreto: string;
  tipoDescuento: TipoDescuentoCupon;
  valorDescuento: number;
  aplicaTodasCategorias: boolean;
  categorias: CategoriaSimple[];
  montoMinimoCompra: number;
  fechaInicio: string;
  fechaFin: string | null;
  limiteUsos: number;
  usosActuales: number;
  estado: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface CuponPayload {
  codigoSecreto: string;
  tipoDescuento: TipoDescuentoCupon;
  valorDescuento: number;
  aplicaTodasCategorias: boolean;
  categoriaIds: number[];
  montoMinimoCompra: number;
  fechaInicio: string;
  fechaFin?: string | null;
  limiteUsos: number;
  estado: string;
}

// ── API: Cupones ─────────────────────────────────────────
// El cupón se aplica siempre dentro del flujo de venta (ventasApi.recalcular
// / ventasApi.crear, con codigoCupon en el body), nunca desde un endpoint
// suelto — así no se puede consumir su límite de usos fuera de una venta.

export const cuponesApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<Cupon>>('/cupones', { page, size, sort: 'idCupon,desc' }),

  listarVigentes: (page = 0, size = 20) =>
    get<PageResponse<Cupon>>('/cupones/vigentes', { page, size }),

  buscarPorId: (id: number) =>
    get<Cupon>(`/cupones/${id}`),

  crear: (body: CuponPayload) =>
    post<Cupon>('/cupones', body),

  actualizar: (id: number, body: CuponPayload) =>
    put<Cupon>(`/cupones/${id}`, body),

  desactivar: (id: number) =>
    del(`/cupones/${id}`),
};

// ── Tipos: Ventas POS ─────────────────────────────────────

export interface DetalleVentaRequest {
  idProducto: number;
  cantidad: number;
  descuentoLinea: number;
}

export interface IngresoVentaRequest {
  metodoPago: string;
  monto: number;
  referencia?: string;
}

export interface CrearVentaRequest {
  idTurnoCaja: number;
  idCliente?: number | null;
  nombreClienteTemporal?: string;
  rncTemporal?: string;
  tipoNcf: string;
  metodoPago: string;
  usaPrecioMayor: boolean;
  descuentoGlobal: number;
  codigoCupon?: string;
  detalles: DetalleVentaRequest[];
  ingresos: IngresoVentaRequest[];
}

export interface RecalcularFacturaRequest {
  metodoPago: string;
  tipoNcf: string;
  usaPrecioMayor: boolean;
  descuentoGlobal?: number;
  codigoCupon?: string;
  detalles: DetalleVentaRequest[];
}


export interface DetalleRecalculado {
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  precioUnitarioOriginal: number | null;
  tipoPrecio: string;
  tasaItbis: number;
  descuentoLinea: number;
  descuentoOferta: number;
  ofertaAplicada: string | null;
  importe: number;
  baseImponible: number;
  itbisLinea: number;
  recalculado: boolean;
  mensajeRecalculo: string | null;
}

export interface RecalcularFacturaResponse {
  detalles: DetalleRecalculado[];
  subtotal: number;
  descuentoTotal: number;
  itbis: number;
  total: number;
  huboRecalculo: boolean;
  codigoCupon: string | null;
  descuentoCupon: number;
}

export interface DetalleVentaResponse {
  idDetalleVenta: number;
  idProducto: number;
  skuProducto: string;
  codigoProducto?: string | null;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  precioUnitarioOriginal: number | null;
  tipoPrecio: string;
  tasaItbis: number;
  descuentoLinea: number;
  descuentoOferta: number;
  descuentoMonto?: number;
  ofertaAplicada: string | null;
  importe: number;
  /** Descuento global + cupón ya prorrateados sobre esta línea. */
  descuentoProrrateado: number;
  baseImponible: number;
  itbisLinea: number;
}

export interface IngresoVentaResponse {
  idIngresoVenta: number;
  metodoPago: string;
  monto: number;
  referencia: string | null;
  fechaRegistro: string;
}

export interface VentaResponse {
  idVenta: number;
  idTurnoCaja: number;
  cajeroNombre: string;
  cajaNombre?: string | null;
  idAlmacen: number | null;
  almacenNombre: string | null;
  idCliente: number | null;
  clienteNombre: string | null;
  clienteRncCedula: string | null;
  nombreClienteTemporal: string | null;
  rncTemporal: string | null;
  numeroControl: string;
  ncf: string | null;
  tipoNcf: string | null;
  fechaVencimientoNcf?: string | null;
  metodoPagoPrincipal: string;
  usaPrecioMayor: boolean;
  subtotal: number;
  descuentoTotal: number;
  itbis: number;
  total: number;
  montoRecibido: number;
  cambio: number;
  codigoCupon: string | null;
  descuentoCupon: number;
  estado: string;
  fechaVenta: string;
  detalles: DetalleVentaResponse[];
  ingresos: IngresoVentaResponse[];
}

/**
 * Fila del Historial de Ventas. El listado no trae líneas ni ingresos: el
 * detalle completo se pide con `ventasApi.buscarPorId`.
 */
export interface VentaResumen {
  idVenta: number;
  numeroControl: string;
  fechaVenta: string;
  ncf: string | null;
  tipoNcf: string | null;
  /** Cliente registrado o, si fue de paso, el nombre temporal capturado. */
  clienteNombre: string | null;
  cajeroNombre: string;
  metodoPagoPrincipal: string;
  total: number;
  estado: string;
}

/** Filtros del historial. Los campos vacíos no viajan: el backend los ignoraría igual. */
export interface VentaFiltros {
  q?: string;
  /** YYYY-MM-DD */
  fechaDesde?: string;
  /** YYYY-MM-DD, inclusiva durante todo el día. */
  fechaHasta?: string;
  cajero?: string;
  metodoPago?: string;
}

// ── API: Ventas POS ──────────────────────────────────────

export const ventasApi = {
  /** Recalcular precios al cambiar método de pago o tipo NCF (preview, no persiste). */
  recalcular: (request: RecalcularFacturaRequest) =>
    post<RecalcularFacturaResponse>('/ventas/recalcular', request),

  /** Procesar una venta completa de forma atómica. */
  procesar: (request: CrearVentaRequest) =>
    post<VentaResponse>('/ventas', request),

  /** Historial de ventas: filtros y paginación resueltos en el backend. */
  listar: (filtros: VentaFiltros = {}, page = 0, size = 20) => {
    const params: Record<string, string | number> = { page, size };
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) params[clave] = valor;
    }
    return get<PageResponse<VentaResumen>>('/ventas', params);
  },

  /** Buscar una venta por ID. */
  buscarPorId: (id: number) =>
    get<VentaResponse>(`/ventas/${id}`),

  /** Obtener el siguiente número de control. */
  siguienteNumero: () =>
    get<{ numeroControl: string }>('/ventas/siguiente-numero'),
};

// ── Tipos: Devoluciones y Notas de Crédito ───────────────
//
//  Los importes fiscales (base imponible, ITBIS, total acreditado) los calcula
//  el backend a partir de los snapshots de la venta original. Aquí solo se
//  transportan: el cliente nunca los reconstruye.

/**
 * Métodos de reembolso que el backend acepta en una devolución nueva.
 *
 * Uno solo: la tienda no entrega dinero por una devolución, acredita una Nota
 * de Crédito B04 redimible en compras posteriores. El historial anterior a esa
 * política sí trae otros valores, por eso `metodoReembolso` de una devolución
 * ya registrada se lee como texto libre y no contra esta lista.
 */
export const METODOS_REEMBOLSO = ['NOTA_CREDITO'] as const;

export type MetodoReembolso = typeof METODOS_REEMBOLSO[number];

/** Fila del historial de devoluciones. El detalle completo se pide por ID. */
export interface DevolucionResumen {
  idDevolucion: number;
  numeroControl: string;
  referenciaOperacion: string;
  fechaDevolucion: string;
  ncf: string;
  ncfAfectado: string | null;
  idVenta: number;
  numeroControlVenta: string;
  cajeroNombre: string;
  metodoReembolso: string;
  total: number;
  estado: string;
}

export interface DetalleDevolucionResponse {
  idDetalleDevolucion: number;
  idDetalleVenta: number;
  idProducto: number;
  skuProducto: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  tasaItbis: number;
  descuentoAcreditado: number;
  importeAcreditado: number;
  baseImponibleAcreditada: number;
  itbisAcreditado: number;
}

export interface DevolucionResponse {
  idDevolucion: number;
  numeroControl: string;
  referenciaOperacion: string;
  motivo: string;
  estado: string;
  metodoReembolso: string;
  fechaDevolucion: string;

  ncf: string;
  tipoNcf: string;
  ncfAfectado: string | null;
  tipoNcfAfectado: string | null;

  idVenta: number;
  numeroControlVenta: string;
  /** Estado en que quedó la venta: PARCIALMENTE_DEVUELTA o DEVUELTA. */
  estadoVenta: string;
  clienteNombre: string | null;
  clienteRncCedula: string | null;

  idTurnoCaja: number;
  cajeroNombre: string;
  idAlmacen: number;
  almacenNombre: string;

  baseImponible: number;
  itbis: number;
  total: number;

  detalles: DetalleDevolucionResponse[];
}

export interface LineaDevoluble {
  idDetalleVenta: number;
  idProducto: number;
  skuProducto: string;
  nombreProducto: string;
  cantidadVendida: number;
  cantidadDevuelta: number;
  cantidadDisponible: number;
  precioUnitario: number;
  tasaItbis: number;
  importe: number;
}

export interface VentaDevoluble {
  idVenta: number;
  numeroControl: string;
  ncf: string | null;
  tipoNcf: string | null;
  estado: string;
  fechaVenta: string;
  idAlmacen: number | null;
  almacenNombre: string | null;
  clienteNombre: string | null;
  /** false cuando la venta ya no admite devoluciones (estado o datos fiscales). */
  devolvible: boolean;
  lineas: LineaDevoluble[];
}

export interface DetalleDevolucionRequest {
  idDetalleVenta: number;
  cantidad: number;
}

export interface CrearDevolucionRequest {
  idVenta: number;
  idTurnoCaja: number;
  motivo: string;
  metodoReembolso: MetodoReembolso;
  /**
   * Llave de idempotencia generada por el cliente. Repetirla responde 409 sin
   * reponer stock, ajustar caja ni consumir otro comprobante.
   */
  referenciaOperacion: string;
  detalles: DetalleDevolucionRequest[];
}

export interface NotaCreditoSaldo {
  idDevolucion: number;
  numeroControl: string;
  ncf: string;
  numeroControlVenta: string;
  ncfAfectado: string;
  nombreCliente: string | null;
  totalDevolucion: number;
  montoDisponible: number;
  montoUsado: number;
  fechaDevolucion: string;
}

// ── API: Devoluciones y Notas de Crédito ─────────────────

export const devolucionesApi = {
  /** Historial paginado, opcionalmente acotado a una venta. Exige VENTA_VER. */
  listar: (idVenta?: number, page = 0, size = 20) => {
    const params: Record<string, string | number> = { page, size };
    if (idVenta != null) params.idVenta = idVenta;
    return get<PageResponse<DevolucionResumen>>('/devoluciones', params);
  },

  buscarPorId: (id: number) =>
    get<DevolucionResponse>(`/devoluciones/${id}`),

  /** Líneas de la venta con cantidad vendida, ya devuelta y disponible. */
  consultarDisponible: (idVenta: number) =>
    get<VentaDevoluble>(`/devoluciones/ventas/${idVenta}/disponible`),

  /** Consulta el saldo disponible de una Nota de Crédito. */
  consultarSaldoNotaCredito: (numero: string) =>
    get<NotaCreditoSaldo>('/devoluciones/nota-credito/saldo', { numero }),

  /** Confirma la devolución y emite la Nota de Crédito. Exige DEVOLUCION_CREAR. */
  crear: (request: CrearDevolucionRequest) =>
    post<DevolucionResponse>('/devoluciones', request),
};

// ── Tipos: Empaques ──────────────────────────────────────

export interface Empaque {
  idEmpaque: number;
  nombre: string;
  cantidad: number;
  descripcion: string | null;
  estado: string;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
}

export const empaquesApi = {
  /** Lista todos (activos e inactivos) para el CRUD. */
  listar: () =>
    get<Empaque[]>('/empaques'),

  /** Lista solo los activos ordenados por cantidad — para el selector del POS. */
  listarActivos: () =>
    get<Empaque[]>('/empaques/activos'),

  crear: (body: { nombre: string; cantidad: number; descripcion?: string; estado?: string }) =>
    post<Empaque>('/empaques', body),

  actualizar: (id: number, body: { nombre: string; cantidad: number; descripcion?: string; estado?: string }) =>
    put<Empaque>(`/empaques/${id}`, body),

  eliminar: (id: number) =>
    del(`/empaques/${id}`),
};

// ── Configuración de Empresa ──────────────────────────────────────────

export interface ConfiguracionEmpresa {
  // Datos fiscales
  nombreComercial: string | null;
  razonSocial: string | null;
  rnc: string | null;
  // Contacto
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
  emailComercial: string | null;
  emailFacturacion: string | null;
  // Dirección
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  // Presencia digital
  sitioWeb: string | null;
  logoUrl: string | null;
  // Términos y políticas
  politicaDevolucion: string | null;
  // Auditoría (solo lectura)
  fechaModificacion: string | null;
}

export const empresaApi = {
  /** Obtiene la configuración actual de la empresa. */
  obtener: () =>
    get<ConfiguracionEmpresa>('/empresa/configuracion'),

  /** Actualiza la configuración de la empresa (requiere CONFIGURACION_VER). */
  actualizar: (body: Omit<ConfiguracionEmpresa, 'fechaModificacion'>) =>
    put<ConfiguracionEmpresa>('/empresa/configuracion', body),
};

// ── Consulta DGII ─────────────────────────────────────────────────────

export interface DgiiConsultaResponse {
  error: boolean;
  codigoHttp: number;
  mensaje: string;
  cedulaRnc: string | null;
  nombreRazonSocial: string | null;
  nombreComercial: string | null;
  categoria: string | null;
  regimenDePagos: string | null;
  estado: string | null;
  actividadEconomica: string | null;
  administracionLocal: string | null;
  facturadorElectronico: string | null;
  rncConsultado: string | null;
}

export const dgiiApi = {
  /** Consulta ficha de contribuyente en la DGII por RNC o Cédula */
  consultarRnc: (rnc: string) =>
    get<DgiiConsultaResponse>(`/dgii/consultar/${encodeURIComponent(rnc)}`),
};

// ── Tipos: Dashboard ─────────────────────────────────────

export interface VentaDiaria {
  fecha: string;
  total: number;
  transacciones: number;
}

export interface MetodoPagoStats {
  metodoPago: string;
  total: number;
  transacciones: number;
}

export interface TopProducto {
  idProducto: number;
  sku: string;
  nombre: string;
  cantidadVendida: number;
  totalVendido: number;
}

export interface UltimaVenta {
  idVenta: number;
  numeroControl: string;
  clienteNombre: string;
  cajeroNombre: string;
  metodoPago: string;
  total: number;
  fechaVenta: string;
}

export interface DashboardStats {
  ventasHoy: number;
  ventasAyer: number;
  totalTransaccionesHoy: number;
  totalTransaccionesAyer: number;
  productosActivos: number;
  productosBajoStock: number;
  itbisHoy: number;
  ventasUltimos7Dias: VentaDiaria[];
  ventasPorMetodoPago: MetodoPagoStats[];
  topProductos: TopProducto[];
  ultimasVentas: UltimaVenta[];
}

export const dashboardApi = {
  stats: () => get<DashboardStats>('/dashboard/stats'),
};

// ── Tipos: Reportes ──────────────────────────────────────

/**
 * Totales del reporte, encadenados para que cuadren a la vista:
 * `totalVentasBrutas − totalNotasCredito = totalVentas` (neto), y lo mismo
 * con el ITBIS. La venta devuelta sigue en `ventas` —su NCF se emitió— pero
 * ya no cuenta como ingreso.
 */
export interface ReporteVentasResponse {
  ventas: VentaResumen[];
  totalVentas: number;          // neto de devoluciones
  totalItbis: number;           // neto de devoluciones
  totalDescuentos: number;
  totalTransacciones: number;
  totalVentasBrutas: number;
  totalItbisBrutos: number;
  totalNotasCredito: number;
  totalItbisNotasCredito: number;
  totalDevoluciones: number;
}

export interface ReporteFiltros {
  desde: string;
  hasta: string;
  cajero?: string;
  metodoPago?: string;
}

export const reportesApi = {
  ventas: (filtros: ReporteFiltros) => {
    const params: Record<string, string | number> = {
      desde: filtros.desde,
      hasta: filtros.hasta,
    };
    if (filtros.cajero) params.cajero = filtros.cajero;
    if (filtros.metodoPago) params.metodoPago = filtros.metodoPago;
    return get<ReporteVentasResponse>('/reportes/ventas', params);
  },
};

// ── NCF Helper ────────────────────────────────────────────────────────

export const getNombreTipoNcf = (tipoNcf?: string | null, ncf?: string | null): string => {
  const tipo = (tipoNcf || (ncf ? ncf.substring(0, 3) : 'B02')).toUpperCase();
  switch (tipo) {
    case 'B01':
    case 'E31':
      return 'FACTURA DE CRÉDITO FISCAL';
    case 'B02':
    case 'E32':
      return 'FACTURA DE CONSUMO';
    case 'B03':
    case 'E33':
      return 'NOTA DE DÉBITO';
    case 'B04':
    case 'E34':
      return 'NOTA DE CRÉDITO';
    case 'B11':
    case 'E41':
      return 'COMPROBANTE DE COMPRAS';
    case 'B12':
      return 'REGISTRO DE GASTOS MENORES';
    case 'B13':
      return 'COMPROBANTE PARA PAGOS AL EXTERIOR';
    case 'B14':
    case 'E44':
      return 'REGIMEN ESPECIAL DE TRIBUTACIÓN';
    case 'B15':
    case 'E45':
      return 'COMPROBANTE GUBERNAMENTAL';
    case 'B16':
      return 'COMPROBANTE PARA EXPORTACIONES';
    default:
      return 'COMPROBANTE FISCAL';
  }
};

export const formatFechaVencimientoNcf = (fecha?: any): string => {
  if (!fecha) return '31/12/2026';
  if (Array.isArray(fecha)) {
    const [y, m, d] = fecha;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  if (typeof fecha === 'string') {
    const clean = fecha.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
  }
  return '31/12/2026';
};

export const resolucionNcfApi = {
  previsualizar: (tipoNcf: string) =>
    get<{ ncfCompleto: string; fechaVencimiento?: string | number[] | null }>(`/ncf/preview/${tipoNcf}`),
};




