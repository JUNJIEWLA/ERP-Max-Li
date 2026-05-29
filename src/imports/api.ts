// ─────────────────────────────────────────────────────────
//  Servicio API centralizado — ERP Max Li
//  Todas las llamadas al backend pasan por aquí.
//  El proxy de Vite redirige /api/* → http://localhost:8080
// ─────────────────────────────────────────────────────────

const BASE_URL = '/api';

// ── Manejo del token JWT ─────────────────────────────────

const TOKEN_KEY = 'maxli_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
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
      if (!res.ok) throw new Error(`Error ${res.status}`);
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

  crear: (body: { nombre: string; descripcion?: string }) =>
    post<Categoria>('/categorias', body),

  actualizar: (id: number, body: { nombre: string; descripcion?: string; estado?: string }) =>
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

  bajoStock: (page = 0, size = 20) =>
    get<PageResponse<Existencia>>('/existencias/bajo-stock', { page, size }),

  buscarPorProducto: (idProducto: number) =>
    get<Existencia>(`/existencias/producto/${idProducto}`),

  crear: (body: { idProducto: number; idAlmacen: number; cantidadActual: number; cantidadMinima: number }) =>
    post<Existencia>('/existencias', body),

  actualizar: (id: number, body: { idProducto: number; idAlmacen: number; cantidadActual: number; cantidadMinima: number }) =>
    put<Existencia>(`/existencias/${id}`, body),
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
