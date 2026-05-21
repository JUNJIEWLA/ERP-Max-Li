import { useEffect, useState } from 'react';
import { Package, TrendingDown, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { existenciasApi, type Existencia } from '../../imports/api';

export default function Inventario() {
  const [bajoStock, setBajoStock] = useState<Existencia[]>([]);
  const [todas, setTodas] = useState<Existencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageTodas, pageBajoStock] = await Promise.all([
        existenciasApi.listar(0, 100),
        existenciasApi.bajoStock(0, 20),
      ]);
      setTodas(pageTodas.content);
      setBajoStock(pageBajoStock.content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Datos para el gráfico — agrupa por nombre de producto (primeras 6)
  const datosGrafico = todas.slice(0, 6).map((e) => ({
    producto: e.productoNombre.length > 15 ? e.productoNombre.slice(0, 15) + '…' : e.productoNombre,
    actual: e.cantidadActual,
    minimo: e.cantidadMinima,
  }));

  const totalUnidades = todas.reduce((sum, e) => sum + e.cantidadActual, 0);
  const alertasCount = bajoStock.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Control de Inventario</h2>
          <p className="text-muted-foreground mt-1">Monitorea los movimientos y niveles de stock</p>
        </div>
        <button
          onClick={cargarDatos}
          className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
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
              <p className="text-muted-foreground text-sm">Productos con Existencia</p>
              <p className="text-2xl mt-1">{loading ? '...' : todas.length}</p>
            </div>
            <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Unidades</p>
              <p className="text-2xl mt-1 text-green-600">{loading ? '...' : totalUnidades.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Con Stock Normal</p>
              <p className="text-2xl mt-1 text-blue-600">{loading ? '...' : todas.length - alertasCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Alertas Stock</p>
              <p className={`text-2xl mt-1 ${alertasCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {loading ? '...' : alertasCount}
              </p>
            </div>
            <div className={`w-12 h-12 ${alertasCount > 0 ? 'bg-red-500' : 'bg-green-500'} rounded-lg flex items-center justify-center text-white`}>
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="animate-spin mx-auto mb-3" size={28} />
          Cargando datos de inventario...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="mb-4">Stock Actual vs Mínimo</h3>
            {datosGrafico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay existencias registradas aún.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="producto" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" name="Stock Actual" fill="#10b981" />
                  <Bar dataKey="minimo" name="Stock Mínimo" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Alertas de bajo stock */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="mb-4">
              Productos Bajo Stock
              {alertasCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">
                  {alertasCount}
                </span>
              )}
            </h3>
            {bajoStock.length === 0 ? (
              <div className="text-center py-12 text-green-600">
                <Package className="mx-auto mb-2" size={32} />
                ¡Todo el stock está dentro del nivel mínimo!
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {bajoStock.map((alerta) => (
                  <div
                    key={alerta.idExistencia}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alerta.productoNombre}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alerta.productoCodigo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-red-600">Stock: {alerta.cantidadActual}</p>
                      <p className="text-xs text-muted-foreground">Mín: {alerta.cantidadMinima}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabla de todas las existencias */}
      {!loading && todas.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Existencias por Producto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground">Código</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Producto</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Stock Actual</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Mínimo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {todas.map((e) => (
                  <tr key={e.idExistencia} className="border-b border-border hover:bg-accent transition-colors">
                    <td className="py-3 px-4 font-mono text-sm">{e.productoCodigo}</td>
                    <td className="py-3 px-4">{e.productoNombre}</td>
                    <td className={`py-3 px-4 font-medium ${e.bajoPuntoReorden ? 'text-red-600' : 'text-green-600'}`}>
                      {e.cantidadActual}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{e.cantidadMinima}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          e.bajoPuntoReorden
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {e.bajoPuntoReorden ? 'Bajo Stock' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
