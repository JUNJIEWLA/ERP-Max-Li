import { Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const movimientosData = [
  { almacen: 'Principal', entradas: 450, salidas: 380 },
  { almacen: 'Sucursal 1', entradas: 280, salidas: 320 },
  { almacen: 'Sucursal 2', entradas: 190, salidas: 210 },
  { almacen: 'Sucursal 3', entradas: 150, salidas: 140 },
];

const alertasStock = [
  { producto: 'Camisa Polo Hombre', codigo: 'PROD-003', stock: 8, minimo: 15, almacen: 'Principal' },
  { producto: 'Tablet Samsung Tab A8', codigo: 'PROD-012', stock: 3, minimo: 10, almacen: 'Sucursal 1' },
  { producto: 'Auriculares Bluetooth', codigo: 'PROD-027', stock: 5, minimo: 20, almacen: 'Principal' },
  { producto: 'Mouse Inalámbrico', codigo: 'PROD-045', stock: 12, minimo: 25, almacen: 'Sucursal 2' },
];

const ultimosMovimientos = [
  { tipo: 'Entrada', producto: 'Laptop Dell Inspiron 15', cantidad: 10, almacen: 'Principal', fecha: '01/05/2026 08:30', usuario: 'Admin' },
  { tipo: 'Salida', producto: 'Samsung Galaxy S24', cantidad: 3, almacen: 'Sucursal 1', fecha: '01/05/2026 09:15', usuario: 'Vendedor 1' },
  { tipo: 'Entrada', producto: 'Zapatillas Nike Air Max', cantidad: 25, almacen: 'Principal', fecha: '01/05/2026 10:00', usuario: 'Admin' },
  { tipo: 'Salida', producto: 'Cafetera Espresso', cantidad: 2, almacen: 'Sucursal 2', fecha: '01/05/2026 11:30', usuario: 'Vendedor 3' },
  { tipo: 'Transferencia', producto: 'Laptop Dell Inspiron 15', cantidad: 5, almacen: 'Principal → S1', fecha: '01/05/2026 12:45', usuario: 'Admin' },
];

export default function Inventario() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2>Control de Inventario</h2>
        <p className="text-muted-foreground mt-1">Monitorea los movimientos y niveles de stock</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Valor Total Stock</p>
              <p className="text-2xl mt-1">RD$ 2.5M</p>
            </div>
            <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Entradas (Hoy)</p>
              <p className="text-2xl mt-1 text-green-600">152</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Salidas (Hoy)</p>
              <p className="text-2xl mt-1 text-blue-600">89</p>
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
              <p className="text-2xl mt-1 text-red-600">23</p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Movimientos por Almacén</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={movimientosData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="almacen" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="entradas" fill="#10b981" />
              <Bar dataKey="salidas" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Productos Bajo Stock</h3>
          <div className="space-y-3">
            {alertasStock.map((alerta, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm">{alerta.producto}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alerta.codigo} - {alerta.almacen}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-600">Stock: {alerta.stock}</p>
                  <p className="text-xs text-muted-foreground">Mín: {alerta.minimo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="mb-4">Últimos Movimientos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">Tipo</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Producto</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Cantidad</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Almacén</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Fecha</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {ultimosMovimientos.map((mov, index) => (
                <tr key={index} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      mov.tipo === 'Entrada'
                        ? 'bg-green-100 text-green-700'
                        : mov.tipo === 'Salida'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {mov.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-4">{mov.producto}</td>
                  <td className="py-3 px-4">{mov.cantidad}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{mov.almacen}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{mov.fecha}</td>
                  <td className="py-3 px-4 text-sm">{mov.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
