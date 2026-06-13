// ─────────────────────────────────────────────────────────
//  Servicio API centralizado — ERP Max Li
//  Todas las llamadas al backend pasan por aquí.
//  El proxy de Vite redirige /api/* → http://localhost:8080
// ─────────────────────────────────────────────────────────

const BASE_URL = '/api';

// ── Manejo del token JWT ─────────────────────────────────

const TOKEN_KEY = 'maxli_token';
export const AUTH_EXPIRED_EVENT = 'maxli-auth-expired';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export const isTokenExpired = (token: string | null = getToken()): boolean => {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000;
};

export const hasValidToken = (): boolean => {
  const token = getToken();
  if (!token) return false;
  if (isTokenExpired(token)) {
    clearToken();
    return false;
  }
  return true;
};

function expireSession(): void {
  clearToken();
  localStorage.removeItem('maxli_user');
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) return {};
  if (isTokenExpired(token)) {
    expireSession();
    return {};
  }
  return { Authorization: `Bearer ${token}` };
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

async function buildErrorMessage(res: Response): Promise<string> {
  const fallback = `Error ${res.status}: ${res.statusText || 'Error'}`;

  if (res.status === 401 || (res.status === 403 && isTokenExpired())) {
    expireSession();
    return 'Tu sesión expiró. Inicia sesión nuevamente.';
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
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(await buildErrorMessage(res));
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await buildErrorMessage(res));
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await buildErrorMessage(res));
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(await buildErrorMessage(res));
}

// ── API: Auth ────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  roles: string[];
  expiresIn: number;
}

export const authApi = {
  login: (username: string, password: string) =>
    // login no pasa por el helper para evitar el header de token
    fetch(BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async res => {
      if (!res.ok) throw new Error(await buildErrorMessage(res));
      return res.json() as Promise<AuthResponse>;
    }),
};

// ── Tipos del dominio ────────────────────────────────────

export interface Producto {
  idProducto: number;
  sku: string;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string;
  precioVenta: number;
  costo: number;
  estado: string;
  idCategoria: number;
  categoriaNombre: string;
  porcentajeMargenCategoria: number;
  idMarca: number;
  marcaNombre: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string;
  estado: string;
  porcentajeMargen: number;
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
  porcentajeVariacion: number;
  porcentajeMargen: number;
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

export interface Rol {
  idRol: number;
  nombre: string;
}

export interface Usuario {
  idUsuario: number;
  username: string;
  email: string;
  estado: string;
  roles: string[];
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface Caja {
  idCaja: number;
  nombre: string;
  estado: string;
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
  idUsuarioApertura: number;
  usernameUsuarioApertura: string;
  idUsuarioCierre: number | null;
  usernameUsuarioCierre: string | null;
  montoInicial: number;
  montoFinalDeclarado: number | null;
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasTransferencia: number;
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

  crear: (body: Omit<Producto, 'idProducto' | 'fechaCreacion' | 'fechaModificacion' | 'categoriaNombre' | 'marcaNombre'>) =>
    post<Producto>('/productos', body),

  actualizar: (id: number, body: Partial<Producto>) =>
    put<Producto>(`/productos/${id}`, body),

  desactivar: (id: number) =>
    del(`/productos/${id}`),
};

// ── API: Categorías ──────────────────────────────────────

export const categoriasApi = {
  listar: (page = 0, size = 100) =>
    get<PageResponse<Categoria>>('/categorias', { page, size }),

  listarActivas: () =>
    get<PageResponse<Categoria>>('/categorias/activas', { page: 0, size: 100 }),

  crear: (body: { nombre: string; descripcion?: string; porcentajeMargen?: number }) =>
    post<Categoria>('/categorias', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; estado?: string; porcentajeMargen?: number }) =>
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
    get<Existencia>(`/existencias/producto/${idProducto}`),

  crear: (body: { idProducto: number; idAlmacen: number; cantidadActual: number; cantidadMinima: number }) =>
    post<Existencia>('/existencias', body),

  actualizar: (id: number, body: { idProducto: number; idAlmacen: number; cantidadActual: number; cantidadMinima: number }) =>
    put<Existencia>(`/existencias/${id}`, body),
};

// ── Tipos: Movimientos de Inventario ─────────────────────

export interface DetalleMovimientoInventario {
  idDetalleMovimiento: number;
  idProducto: number;
  productoNombre: string;
  productoSku: string;
  cantidad: number;
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
    get<PageResponse<MovimientoInventario>>('/movimientos', { page, size }),

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

// ── API: Roles ───────────────────────────────────────────

export const rolesApi = {
  listar: (page = 0, size = 50) =>
    get<PageResponse<Rol>>('/roles', { page, size }),

  buscarPorId: (id: number) =>
    get<Rol>(`/roles/${id}`),

  crear: (nombre: string) =>
    post<Rol>('/roles', { nombre }),

  actualizar: (id: number, nombre: string) =>
    put<Rol>(`/roles/${id}`, { nombre }),

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

  crear: (body: { username: string; email: string; password: string; estado?: string }) =>
    post<Usuario>('/usuarios', body),

  actualizar: (id: number, body: { username: string; email: string; password: string; estado?: string }) =>
    put<Usuario>(`/usuarios/${id}`, body),

  desactivar: (id: number) =>
    del(`/usuarios/${id}`),

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

  crear: (body: { nombre: string; estado?: string }) =>
    post<Caja>('/cajas', body),

  actualizar: (id: number, body: { nombre: string; estado?: string }) =>
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
    get<PageResponse<MovimientoCaja>>(`/cajas/chicas/${idCajaChica}/movimientos`, { page, size }),

  buscarPorId: (idMovimiento: number) =>
    get<MovimientoCaja>(`/cajas/chicas/movimientos/${idMovimiento}`),

  registrar: (idCajaChica: number, body: { tipoMovimiento: TipoMovimientoCaja; monto: number; concepto: string }) =>
    post<MovimientoCaja>(`/cajas/chicas/${idCajaChica}/movimientos`, body),
};

export const turnosCajaApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<TurnoCaja>>('/cajas/turnos', { page, size }),

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

  abrir: (body: { idCaja: number; montoInicial: number; observacionApertura?: string }) =>
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
}

export interface PagoProveedor {
  idPagoProveedor: number;
  idOrdenCompra: number;
  montoPagado: number;
  metodo: string;
  numeroReferencia: string | null;
  fecha: string;
}

export interface OrdenCompra {
  idOrdenCompra: number;
  idProveedor: number;
  nombreProveedor: string;
  total: number;
  estado: string;
  estadoPago: string;
  totalPagado: number;
  balancePendiente: number;
  detalles: DetalleOrdenCompra[];
  pagos: PagoProveedor[];
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
    get<PageResponse<OrdenCompra>>('/ordenes-compra', { page, size }),

  listarPorProveedor: (idProveedor: number, page = 0, size = 20) =>
    get<PageResponse<OrdenCompra>>(`/ordenes-compra/proveedor/${idProveedor}`, { page, size }),

  buscarPorId: (id: number) =>
    get<OrdenCompra>(`/ordenes-compra/${id}`),

  crear: (body: { idProveedor: number; detalles: { idProducto: number; cantidad: number; precioUnitario: number }[] }) =>
    post<OrdenCompra>('/ordenes-compra', body),

  enviar: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/enviar`, {}),

  anular: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/anular`, {}),

  forzarCierre: (id: number) =>
    put<OrdenCompra>(`/ordenes-compra/${id}/forzar-cierre`, {}),

  registrarPago: (idOrden: number, body: { montoPagado: number; metodo: string; numeroReferencia?: string }) =>
    post<PagoProveedor>(`/ordenes-compra/${idOrden}/pagos`, body),

  listarPagos: (idOrden: number) =>
    get<PagoProveedor[]>(`/ordenes-compra/${idOrden}/pagos`),
};

// ── API: Notas de Recepción ──────────────────────────────

export const notasRecepcionApi = {
  listar: (page = 0, size = 20) =>
    get<PageResponse<NotaRecepcion>>('/notas-recepcion', { page, size }),

  listarPorOrden: (idOrden: number, page = 0, size = 20) =>
    get<PageResponse<NotaRecepcion>>(`/notas-recepcion/orden/${idOrden}`, { page, size }),

  buscarPorId: (id: number) =>
    get<NotaRecepcion>(`/notas-recepcion/${id}`),

  crear: (body: { idOrdenCompra: number; detalles: { idDetalleOrdenCompra: number; cantidadRecibida: number; observacion: string; notas?: string }[] }) =>
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
  }>) => put<Cliente>(`/clientes/${id}`, body),

  desactivar: (id: number) =>
    del(`/clientes/${id}`),
};

// ── API: Historial de Costos ─────────────────────────────

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
