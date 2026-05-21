import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Package, AlertTriangle, Filter, RefreshCw } from 'lucide-react';
import { productosApi, categoriasApi, type Producto, type Categoria } from '../../imports/api';

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [totalElementos, setTotalElementos] = useState(0);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageProductos, pageCategorias] = await Promise.all([
        productosApi.listar(0, 50),
        categoriasApi.listarActivas(),
      ]);
      setProductos(pageProductos.content);
      setTotalElementos(pageProductos.totalElements);
      setCategorias(pageCategorias.content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const desactivarProducto = async (id: number) => {
    if (!confirm('¿Desactivar este producto?')) return;
    try {
      await productosApi.desactivar(id);
      await cargarDatos();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al desactivar');
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !categoriaFiltro || p.categoriaNombre === categoriaFiltro;
    return coincideBusqueda && coincideCategoria;
  });

  const totalActivos = productos.filter((p) => p.estado === 'ACTIVO').length;
  const totalCategorias = new Set(productos.map((p) => p.categoriaNombre)).size;

  const formatPrecio = (valor: number) =>
    `RD$ ${Number(valor).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Catálogo de Productos</h2>
          <p className="text-muted-foreground mt-1">Gestiona tu inventario de productos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargarDatos}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={18} />
          </button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Plus size={20} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Productos</p>
              <p className="text-2xl mt-1">{loading ? '...' : totalElementos}</p>
            </div>
            <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Activos</p>
              <p className="text-2xl mt-1 text-green-600">{loading ? '...' : totalActivos}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Inactivos</p>
              <p className="text-2xl mt-1 text-red-600">{loading ? '...' : totalElementos - totalActivos}</p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Categorías</p>
              <p className="text-2xl mt-1">{loading ? '...' : totalCategorias}</p>
            </div>
            <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-80 pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg"
            />
          </div>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 bg-input-background border border-border rounded-lg"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((cat) => (
              <option key={cat.idCategoria} value={cat.nombre}>
                {cat.nombre}
              </option>
            ))}
          </select>

          <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2">
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            Cargando productos...
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="mx-auto mb-2" size={32} />
            {busqueda || categoriaFiltro ? 'No se encontraron productos con ese filtro.' : 'No hay productos registrados aún.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground">Código</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Nombre</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Categoría</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Marca</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Precio Venta</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Estado</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((producto) => (
                  <tr key={producto.idProducto} className="border-b border-border hover:bg-accent transition-colors">
                    <td className="py-3 px-4 font-mono text-sm">{producto.codigo}</td>
                    <td className="py-3 px-4">{producto.nombre}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{producto.categoriaNombre}</td>
                    <td className="py-3 px-4 text-sm">{producto.marcaNombre}</td>
                    <td className="py-3 px-4">{formatPrecio(producto.precioVenta)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          producto.estado === 'ACTIVO'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {producto.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-accent rounded" title="Ver">
                          <Eye size={18} className="text-muted-foreground" />
                        </button>
                        <button className="p-1 hover:bg-accent rounded" title="Editar">
                          <Edit size={18} className="text-muted-foreground" />
                        </button>
                        <button
                          className="p-1 hover:bg-accent rounded"
                          title="Desactivar"
                          onClick={() => desactivarProducto(producto.idProducto)}
                        >
                          <Trash2 size={18} className="text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-4">
              Mostrando {productosFiltrados.length} de {totalElementos} productos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
