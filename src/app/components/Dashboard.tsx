import { DollarSign, ShoppingBag, Package, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const stats = [
  {
    label: 'Ventas del Día',
    value: 'RD$ 45,230.50',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign,
    color: 'bg-chart-1'
  },
  {
    label: 'Órdenes Procesadas',
    value: '127',
    change: '+8.2%',
    trend: 'up',
    icon: ShoppingBag,
    color: 'bg-chart-2'
  },
  {
    label: 'Productos en Stock',
    value: '2,543',
    change: '-3.1%',
    trend: 'down',
    icon: Package,
    color: 'bg-chart-3'
  },
  {
    label: 'Margen de Ganancia',
    value: '32.4%',
    change: '+2.1%',
    trend: 'up',
    icon: TrendingUp,
    color: 'bg-chart-4'
  },
];

const salesData = [
  { mes: 'Ene', ventas: 45000, compras: 28000 },
  { mes: 'Feb', ventas: 52000, compras: 32000 },
  { mes: 'Mar', ventas: 48000, compras: 29000 },
  { mes: 'Abr', ventas: 61000, compras: 35000 },
  { mes: 'May', ventas: 58000, compras: 33000 },
  { mes: 'Jun', ventas: 67000, compras: 38000 },
];

const categoryData = [
  { name: 'Electrónica', value: 35 },
  { name: 'Ropa', value: 25 },
  { name: 'Hogar', value: 20 },
  { name: 'Deportes', value: 12 },
  { name: 'Otros', value: 8 },
];

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

const recentSales = [
  { id: 'VT-001', cliente: 'Juan Pérez', monto: 'RD$ 2,450.00', fecha: '01/05/2026 09:23' },
  { id: 'VT-002', cliente: 'María González', monto: 'RD$ 1,230.50', fecha: '01/05/2026 10:15' },
  { id: 'VT-003', cliente: 'Carlos Rodríguez', monto: 'RD$ 3,890.00', fecha: '01/05/2026 11:42' },
  { id: 'VT-004', cliente: 'Ana Martínez', monto: 'RD$ 850.00', fecha: '01/05/2026 12:05' },
  { id: 'VT-005', cliente: 'Luis Fernández', monto: 'RD$ 5,120.00', fecha: '01/05/2026 13:30' },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'up' ? ArrowUpRight : ArrowDownRight;

          return (
            <div key={index} className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-white`}>
                  <Icon size={24} />
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendIcon size={16} />
                  {stat.change}
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
              <p className="text-2xl">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Ventas vs Compras</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#FF6B6B" strokeWidth={2} />
              <Line type="monotone" dataKey="compras" stroke="#4ECDC4" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Ventas por Categoría</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="mb-4">Últimas Ventas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">ID Venta</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Monto</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.id} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 px-4">{sale.id}</td>
                  <td className="py-3 px-4">{sale.cliente}</td>
                  <td className="py-3 px-4">{sale.monto}</td>
                  <td className="py-3 px-4 text-muted-foreground">{sale.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
