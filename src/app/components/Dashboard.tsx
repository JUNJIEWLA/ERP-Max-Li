import { useEffect, useState, useCallback } from 'react';
import {
  DollarSign, ShoppingBag, Package, AlertTriangle, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, Receipt
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  dashboardApi, type DashboardStats, type VentaDiaria,
  type MetodoPagoStats, type TopProducto, type UltimaVenta
} from '../../imports/api';

// ── Formateo ──────────────────────────────────────────────
const fmtMoneda = (v: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v);

const fmtCompacto = (v: number) => {
  if (v >= 1_000_000) return `RD$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `RD$ ${(v / 1_000).toFixed(1)}K`;
  return fmtMoneda(v);
};

const fmtFechaCorta = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-DO', { weekday: 'short', day: '2-digit', month: 'short' });
};

const fmtFechaHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const pctCambio = (hoy: number, ayer: number): { texto: string; positivo: boolean } => {
  if (ayer === 0 && hoy === 0) return { texto: '—', positivo: true };
  if (ayer === 0) return { texto: '+100%', positivo: true };
  const pct = ((hoy - ayer) / ayer) * 100;
  return {
    texto: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    positivo: pct >= 0,
  };
};

// ── Colores de gráficas ──────────────────────────────────
const COLORES_METODO: Record<string, string> = {
  EFECTIVO: '#10B981',
  TARJETA: '#6366F1',
  TRANSFERENCIA: '#F59E0B',
  CHEQUE: '#EF4444',
  NOTA_CREDITO: '#8B5CF6',
};

const NOMBRES_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  NOTA_CREDITO: 'Nota de Crédito',
};

// ── Tooltip personalizado ────────────────────────────────
const CustomTooltipArea = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmtMoneda(p.value)}
        </p>
      ))}
    </div>
  );
};

const CustomTooltipPie = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="font-mono" style={{ color: d.payload.fill }}>{fmtMoneda(d.value)}</p>
      <p className="text-muted-foreground text-xs">{d.payload.transacciones} transacciones</p>
    </div>
  );
};

// ── Componente Dashboard ─────────────────────────────────

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    dashboardApi.stats()
      .then(data => {
        setStats(data);
        setLastRefresh(new Date());
      })
      .catch((e: any) => setError(e.message || 'Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 60_000); // Auto-refresh cada 60s
    return () => clearInterval(interval);
  }, [cargar]);

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={32} />
        <p>Cargando dashboard…</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-destructive">
        <AlertTriangle size={32} />
        <p>{error}</p>
        <button onClick={cargar} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
          Reintentar
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // ── KPI Cards ──────────────────────────────────────────
  const cambioVentas = pctCambio(stats.ventasHoy, stats.ventasAyer);
  const cambioTx = pctCambio(stats.totalTransaccionesHoy, stats.totalTransaccionesAyer);

  const kpis = [
    {
      label: 'Ventas del Día',
      value: fmtCompacto(stats.ventasHoy),
      cambio: cambioVentas,
      icon: DollarSign,
      gradiente: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Transacciones Hoy',
      value: String(stats.totalTransaccionesHoy),
      cambio: cambioTx,
      icon: ShoppingBag,
      gradiente: 'from-blue-500 to-indigo-600',
    },
    {
      label: 'ITBIS Recaudado',
      value: fmtCompacto(stats.itbisHoy),
      cambio: null,
      icon: Receipt,
      gradiente: 'from-violet-500 to-purple-600',
    },
    {
      label: stats.productosBajoStock > 0 ? 'Bajo Stock' : 'Productos Activos',
      value: stats.productosBajoStock > 0
        ? `${stats.productosBajoStock} alerta${stats.productosBajoStock > 1 ? 's' : ''}`
        : String(stats.productosActivos),
      cambio: null,
      icon: stats.productosBajoStock > 0 ? AlertTriangle : Package,
      gradiente: stats.productosBajoStock > 0 ? 'from-amber-500 to-orange-600' : 'from-cyan-500 to-sky-600',
    },
  ];

  // ── Datos para gráficas ────────────────────────────────
  const areaData = stats.ventasUltimos7Dias.map((d: VentaDiaria) => ({
    fecha: fmtFechaCorta(d.fecha),
    Ventas: d.total,
    Transacciones: d.transacciones,
  }));

  const pieData = stats.ventasPorMetodoPago.map((m: MetodoPagoStats) => ({
    name: NOMBRES_METODO[m.metodoPago] || m.metodoPago,
    value: m.total,
    transacciones: m.transacciones,
    fill: COLORES_METODO[m.metodoPago] || '#94A3B8',
  }));

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* ── Header con actualización ──────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Última actualización: {lastRefresh.toLocaleTimeString('es-DO')}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${kpi.gradiente} flex items-center justify-center text-white shadow-md`}>
                  <Icon size={20} />
                </div>
                {kpi.cambio && (
                  <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                    kpi.cambio.positivo
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-red-500/10 text-red-600'
                  }`}>
                    {kpi.cambio.positivo ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {kpi.cambio.texto}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Gráficas ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Área Chart — 3/5 del ancho */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ventas — Últimos 7 Días</h3>
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltipArea />} />
                <Area
                  type="monotone"
                  dataKey="Ventas"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#gradVentas)"
                  dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No hay datos de ventas en los últimos 7 días
            </div>
          )}
        </div>

        {/* Pie Chart — 2/5 del ancho */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ventas por Método de Pago</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipPie />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No hay ventas registradas hoy
            </div>
          )}
        </div>
      </div>

      {/* ── Tablas inferiores ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 Productos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            Top Productos del Día
          </h3>
          {stats.topProductos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium text-right">Cant.</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProductos.map((p: TopProducto, i: number) => (
                    <tr key={p.idProducto} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="py-2.5">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          i === 0 ? 'bg-amber-500/15 text-amber-600' :
                          i === 1 ? 'bg-slate-300/20 text-slate-500' :
                          i === 2 ? 'bg-orange-400/15 text-orange-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium text-foreground">{p.nombre}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                      </td>
                      <td className="py-2.5 text-right font-semibold">{p.cantidadVendida}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-emerald-600">{fmtMoneda(p.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              No hay ventas de productos hoy
            </div>
          )}
        </div>

        {/* Últimas 10 Ventas */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Receipt size={16} className="text-blue-500" />
            Últimas Ventas
          </h3>
          {stats.ultimasVentas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">N° Control</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ultimasVentas.map((v: UltimaVenta) => (
                    <tr key={v.idVenta} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{v.numeroControl}</td>
                      <td className="py-2.5 font-medium text-foreground truncate max-w-[140px]">{v.clienteNombre}</td>
                      <td className="py-2.5 text-right font-mono font-semibold">{fmtMoneda(v.total)}</td>
                      <td className="py-2.5 text-right text-muted-foreground text-xs">{fmtFechaHora(v.fechaVenta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              No hay ventas registradas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
