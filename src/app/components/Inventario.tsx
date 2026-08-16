import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package, TrendingDown, TrendingUp, AlertTriangle, RefreshCw,
  Search, Filter, Download, X, Eye, Pencil, PlusCircle, MinusCircle,
  Loader2, DollarSign, BarChart2, CheckCircle2, XCircle, ChevronUp, ChevronDown, Warehouse
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  existenciasApi, categoriasApi, productosApi, almacenesApi,
  type Existencia, type Categoria, type Producto, type Almacen
} from '../../imports/api';

// ── Helpers ──────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(v);

const fmtNum = (v: number) => v.toLocaleString('es-DO');

type StockStatus = 'agotado' | 'critico' | 'bajo' | 'normal';

function getStockStatus(actual: number, minimo: number): StockStatus {
  if (actual === 0) return 'agotado';
  if (actual <= minimo * 0.5) return 'critico';
  if (actual <= minimo) return 'bajo';
  return 'normal';
}

const STATUS_CONFIG: Record<StockStatus, {
  label: string; dot: string; badge: string; row: string;
}> = {
  normal:   { label: 'Normal',   dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', row: '' },
  bajo:     { label: 'Bajo Stock',  dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 border-amber-200',   row: 'bg-amber-50/30' },
  critico:  { label: 'Crítico',  dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200',        row: 'bg-red-50/30' },
  agotado:  { label: 'Agotado',  dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600 border-slate-200',  row: 'bg-slate-50/40' },
};

// ── Modal de Ajuste Rápido ────────────────────────────────
interface AjusteModalProps {
  existencia: Existencia;
  productoMap: Record<number, Producto>;
  onClose: () => void;
  onSaved: () => void;
}

function AjusteModal({ existencia, productoMap, onClose, onSaved }: AjusteModalProps) {
  const [tipo, setTipo] = useState<'sumar' | 'restar'>('sumar');
  const [cantidad, setCantidad] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const prod = productoMap[existencia.idProducto];

  const handleSave = async () => {
    if (cantidad <= 0) { setError('La cantidad debe ser mayor que 0.'); return; }
    if (tipo === 'restar' && cantidad > existencia.cantidadActual) {
      setError(`No puedes restar más del stock actual (${existencia.cantidadActual}).`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await existenciasApi.actualizar(existencia.idExistencia, {
        // El servidor suma/resta el delta tras bloquear la fila. Enviar un
        // saldo calculado aquí podría sobrescribir una venta concurrente.
        deltaCantidadActual: tipo === 'sumar' ? cantidad : -cantidad,
        cantidadMinima: existencia.cantidadMinima,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al ajustar el stock.');
    } finally {
      setSaving(false);
    }
  };

  const nuevoStock = tipo === 'sumar'
    ? existencia.cantidadActual + cantidad
    : Math.max(0, existencia.cantidadActual - cantidad);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <BarChart2 size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Ajuste Rápido de Stock</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Producto info */}
          <div className="bg-muted/40 rounded-xl px-4 py-3">
            <p className="font-semibold text-sm">{existencia.productoNombre}</p>
            <p className="text-xs text-muted-foreground font-mono">{existencia.productoCodigo}</p>
            <div className="flex gap-4 mt-2 text-xs">
              <span>Stock actual: <strong>{existencia.cantidadActual}</strong></span>
              <span>Mínimo: <strong>{existencia.cantidadMinima}</strong></span>
              {prod && <span>Costo: <strong>{fmtCurrency(prod.costo)}</strong></span>}
            </div>
          </div>

          {/* Tipo */}
          <div className="flex gap-2">
            <button
              onClick={() => setTipo('sumar')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                tipo === 'sumar'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <PlusCircle size={16} /> Entrada
            </button>
            <button
              onClick={() => setTipo('restar')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                tipo === 'restar'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <MinusCircle size={16} /> Salida
            </button>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Cantidad</label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm font-mono text-right focus:ring-2 focus:ring-primary focus:outline-none text-lg font-bold"
            />
          </div>

          {/* Preview */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold ${
            tipo === 'sumar' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}>
            <span className="text-muted-foreground">Nuevo stock:</span>
            <span className={`text-xl font-bold ${tipo === 'sumar' ? 'text-emerald-700' : 'text-red-700'}`}>
              {nuevoStock}
            </span>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-2 text-sm rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
              tipo === 'sumar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de detalle ──────────────────────────────────────
function DetalleModal({ existencia, productoMap, onClose }: {
  existencia: Existencia;
  productoMap: Record<number, Producto>;
  onClose: () => void;
}) {
  const prod = productoMap[existencia.idProducto];
  const status = getStockStatus(existencia.cantidadActual, existencia.cantidadMinima);
  const cfg = STATUS_CONFIG[status];
  const valorInventario = prod ? prod.costo * existencia.cantidadActual : 0;
  const margen = prod && prod.costo > 0
    ? (((prod.precioVenta - prod.costo) / prod.costo) * 100).toFixed(1)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Eye size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Detalle de Existencia</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Package size={22} />
            </div>
            <div className="flex-1">
              <p className="font-bold">{existencia.productoNombre}</p>
              <p className="text-xs text-muted-foreground font-mono">{existencia.productoCodigo}</p>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Stock Actual', value: fmtNum(existencia.cantidadActual), color: status === 'normal' ? 'text-emerald-600' : 'text-red-600', big: true },
              { label: 'Stock Mínimo', value: fmtNum(existencia.cantidadMinima), color: 'text-amber-600', big: true },
              ...(prod ? [
                { label: 'Precio Venta', value: fmtCurrency(prod.precioVenta), color: 'text-blue-600', big: false },
                { label: 'Costo Unitario', value: fmtCurrency(prod.costo), color: 'text-muted-foreground', big: false },
                { label: 'Valor en Inventario', value: fmtCurrency(valorInventario), color: 'text-purple-600', big: false },
                { label: 'Margen de Ganancia', value: margen ? `${margen}%` : '—', color: 'text-green-600', big: false },
              ] : []),
            ].map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-xl px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`${item.big ? 'text-xl' : 'text-sm'} font-bold mt-0.5 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {prod && (
            <div className="bg-muted/30 rounded-xl px-3 py-2.5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Categoría</span><span>{prod.categoriaNombre}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Marca</span><span>{prod.marcaNombre}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estado Producto</span>
                <span className={prod.estado === 'ACTIVO' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>{prod.estado}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
type SortField = 'nombre' | 'cantidadActual' | 'cantidadMinima' | 'valor';
type SortDir = 'asc' | 'desc';
type StockFilter = 'todos' | 'normal' | 'bajo' | 'critico' | 'agotado';

export default function Inventario() {
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [stockFiltro, setStockFiltro] = useState<StockFilter>('todos');
  const [almacenFiltro, setAlmacenFiltro] = useState<string>('');  // '' = General (todos)

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Paginación
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Modales
  const [detalleItem, setDetalleItem] = useState<Existencia | null>(null);
  const [ajusteItem, setAjusteItem] = useState<Existencia | null>(null);

  // Mapa producto por id para lookups O(1)
  const productoMap = useMemo<Record<number, Producto>>(
    () => Object.fromEntries(productos.map(p => [p.idProducto, p])),
    [productos]
  );

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageExistencias, pageCategorias, pageProductos, pageAlmacenes] = await Promise.all([
        almacenFiltro
          ? existenciasApi.listarPorAlmacen(Number(almacenFiltro), 0, 500)
          : existenciasApi.listar(0, 500),
        categoriasApi.listarActivas(),
        productosApi.listarActivos(0, 500),
        almacenesApi.listar(0, 100),
      ]);
      setExistencias(pageExistencias.content);
      setCategorias(pageCategorias.content);
      setProductos(pageProductos.content);
      setAlmacenes(pageAlmacenes.content.filter(a => a.estado === 'ACTIVO'));
    } catch (e: any) {
      setError(e.message || 'Error al cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [almacenFiltro]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  // reset page when filters change
  useEffect(() => { setPage(0); }, [search, categoriaFiltro, stockFiltro, almacenFiltro, sortField, sortDir]);

  // ── KPIs ──────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalUnidades = existencias.reduce((s, e) => s + e.cantidadActual, 0);
    const valorTotal = existencias.reduce((s, e) => {
      const p = productoMap[e.idProducto];
      return s + (p ? p.costo * e.cantidadActual : 0);
    }, 0);
    const agotados  = existencias.filter(e => e.cantidadActual === 0).length;
    const bajoStock = existencias.filter(e => e.bajoPuntoReorden && e.cantidadActual > 0).length;
    const normal    = existencias.filter(e => !e.bajoPuntoReorden && e.cantidadActual > 0).length;
    return { totalUnidades, valorTotal, agotados, bajoStock, normal, total: existencias.length };
  }, [existencias, productoMap]);

  // ── Filtrado + ordenamiento ───────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    // Obtener categoría del producto
    const getCatName = (e: Existencia) => productoMap[e.idProducto]?.categoriaNombre ?? '';

    let result = existencias.filter(e => {
      const matchQ = !q
        || e.productoNombre.toLowerCase().includes(q)
        || e.productoCodigo.toLowerCase().includes(q);
      const matchCat = !categoriaFiltro || getCatName(e) === categoriaFiltro;
      const st = getStockStatus(e.cantidadActual, e.cantidadMinima);
      const matchStock = stockFiltro === 'todos' || st === stockFiltro;
      return matchQ && matchCat && matchStock;
    });

    result = [...result].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortField === 'nombre') { va = a.productoNombre; vb = b.productoNombre; }
      else if (sortField === 'cantidadActual') { va = a.cantidadActual; vb = b.cantidadActual; }
      else if (sortField === 'cantidadMinima') { va = a.cantidadMinima; vb = b.cantidadMinima; }
      else if (sortField === 'valor') {
        va = (productoMap[a.idProducto]?.costo ?? 0) * a.cantidadActual;
        vb = (productoMap[b.idProducto]?.costo ?? 0) * b.cantidadActual;
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return result;
  }, [existencias, productoMap, search, categoriaFiltro, stockFiltro, sortField, sortDir]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <span className="w-3" />;

  // ── Exportar CSV ──────────────────────────────────────

  const handleExportCSV = () => {
    const headers = ['Código,Nombre,Categoría,Precio Venta,Costo,Stock Actual,Stock Mínimo,Valor Inventario,Estado'];
    const rows = filtered.map(e => {
      const p = productoMap[e.idProducto];
      const st = getStockStatus(e.cantidadActual, e.cantidadMinima);
      return [
        e.productoCodigo,
        `"${e.productoNombre}"`,
        `"${p?.categoriaNombre ?? ''}"`,
        p?.precioVenta ?? 0,
        p?.costo ?? 0,
        e.cantidadActual,
        e.cantidadMinima,
        p ? (p.costo * e.cantidadActual).toFixed(2) : 0,
        STATUS_CONFIG[st].label,
      ].join(',');
    });
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Datos gráfico ─────────────────────────────────────

  const datosGrafico = useMemo(() =>
    existencias
      .sort((a, b) => b.cantidadActual - a.cantidadActual)
      .slice(0, 8)
      .map(e => ({
        producto: e.productoNombre.length > 14 ? e.productoNombre.slice(0, 14) + '…' : e.productoNombre,
        actual: e.cantidadActual,
        minimo: e.cantidadMinima,
        status: getStockStatus(e.cantidadActual, e.cantidadMinima),
      })),
    [existencias]
  );

  // ── Render ────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Warehouse size={22} className="text-blue-500" />
            Control de Existencias
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {kpis.total} registros · {filtered.length} visibles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-exportar-inventario"
            onClick={handleExportCSV}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
            title="Exportar vista actual a CSV"
          >
            <Download size={15} />
            Exportar CSV
          </button>
          <button
            id="btn-actualizar-inventario"
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-2 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total productos */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Registros</p>
            <p className="text-2xl font-bold mt-1">{loading ? '—' : fmtNum(kpis.total)}</p>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Package size={20} />
          </div>
        </div>

        {/* Total unidades */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Unidades</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{loading ? '—' : fmtNum(kpis.totalUnidades)}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Valoración total */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Inventario</p>
            <p className="text-lg font-bold mt-1 text-purple-600">{loading ? '—' : fmtCurrency(kpis.valorTotal)}</p>
            <p className="text-xs text-muted-foreground">Costo × Stock</p>
          </div>
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Bajo stock */}
        <div
          className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 transition-colors"
          onClick={() => setStockFiltro(s => s === 'bajo' ? 'todos' : 'bajo')}
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Bajo Stock</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.bajoStock > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {loading ? '—' : kpis.bajoStock}
            </p>
          </div>
          <div className={`w-10 h-10 ${kpis.bajoStock > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} rounded-xl flex items-center justify-center`}>
            <TrendingDown size={20} />
          </div>
        </div>

        {/* Agotados */}
        <div
          className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-red-400 transition-colors"
          onClick={() => setStockFiltro(s => s === 'agotado' ? 'todos' : 'agotado')}
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Agotados</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.agotados > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {loading ? '—' : kpis.agotados}
            </p>
          </div>
          <div className={`w-10 h-10 ${kpis.agotados > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'} rounded-xl flex items-center justify-center`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ── Gráfico ────────────────────────────────────── */}
      {!loading && datosGrafico.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-muted-foreground" />
            Top 8 Productos — Stock Actual vs Mínimo
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosGrafico} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="producto" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name: string) => [fmtNum(v), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="actual" name="Stock Actual" radius={[4, 4, 0, 0]}>
                {datosGrafico.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.status === 'agotado' ? '#94a3b8' :
                      entry.status === 'critico' ? '#ef4444' :
                      entry.status === 'bajo'    ? '#f59e0b' : '#10b981'
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="minimo" name="Stock Mínimo" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="input-buscar-inventario"
            type="text"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Categoría */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted-foreground" />
          <select
            id="filtro-categoria-inventario"
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.idCategoria} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Almacén */}
        <div className="flex items-center gap-1.5">
          <Warehouse size={14} className="text-muted-foreground" />
          <select
            id="filtro-almacen-inventario"
            value={almacenFiltro}
            onChange={e => setAlmacenFiltro(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">General (Todos los almacenes)</option>
            {almacenes.map(a => <option key={a.idAlmacen} value={String(a.idAlmacen)}>{a.nombre}</option>)}
          </select>
        </div>

        {/* Estado Stock */}
        <select
          id="filtro-stock-inventario"
          value={stockFiltro}
          onChange={e => setStockFiltro(e.target.value as StockFilter)}
          className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
        >
          <option value="todos">Todos los estados</option>
          <option value="normal">✅ Stock Normal</option>
          <option value="bajo">⚠️ Bajo Stock</option>
          <option value="critico">🔴 Stock Crítico</option>
          <option value="agotado">⬜ Agotados</option>
        </select>

        {/* Chips activos */}
        {(search || categoriaFiltro || stockFiltro !== 'todos' || almacenFiltro) && (
          <button
            onClick={() => { setSearch(''); setCategoriaFiltro(''); setStockFiltro('todos'); setAlmacenFiltro(''); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabla Principal ──────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {/* Código */}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Código SKU
                </th>
                {/* Almacén — solo si filtro es General */}
                {!almacenFiltro && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Almacén
                  </th>
                )}
                {/* Nombre */}
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('nombre')}
                >
                  <span className="flex items-center gap-1">Nombre <SortIcon field="nombre" /></span>
                </th>
                {/* Categoría */}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Categoría
                </th>
                {/* Precio */}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Precio Venta
                </th>
                {/* Costo */}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Costo
                </th>
                {/* Stock Actual */}
                <th
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('cantidadActual')}
                >
                  <span className="flex items-center justify-center gap-1">Stock <SortIcon field="cantidadActual" /></span>
                </th>
                {/* Mínimo */}
                <th
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('cantidadMinima')}
                >
                  <span className="flex items-center justify-center gap-1">Mínimo <SortIcon field="cantidadMinima" /></span>
                </th>
                {/* Valor */}
                <th
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort('valor')}
                >
                  <span className="flex items-center justify-end gap-1">Valor Inv. <SortIcon field="valor" /></span>
                </th>
                {/* Estado */}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado Stock
                </th>
                {/* Acciones */}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-muted-foreground">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2" />
                    Cargando inventario…
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-muted-foreground">
                    <Package size={36} className="mx-auto mb-2 opacity-30" />
                    <p>No se encontraron productos con los filtros aplicados.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((e) => {
                  const prod = productoMap[e.idProducto];
                  const st = getStockStatus(e.cantidadActual, e.cantidadMinima);
                  const cfg = STATUS_CONFIG[st];
                  const valorInv = prod ? prod.costo * e.cantidadActual : null;

                  return (
                    <tr
                      key={e.idExistencia}
                      className={`border-b border-border/60 transition-colors hover:bg-muted/20 ${cfg.row}`}
                    >
                      {/* SKU */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {e.productoCodigo}
                      </td>

                      {/* Almacén — solo si filtro es General */}
                      {!almacenFiltro && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                            {e.almacenNombre || '—'}
                          </span>
                        </td>
                      )}

                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <p className="font-medium max-w-[180px] truncate" title={e.productoNombre}>
                          {e.productoNombre}
                        </p>
                        {prod?.estado === 'INACTIVO' && (
                          <span className="text-xs text-red-500">Producto inactivo</span>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3">
                        {prod ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 border border-violet-200">
                            {prod.categoriaNombre}
                          </span>
                        ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>

                      {/* Precio venta */}
                      <td className="px-4 py-3 text-right font-semibold">
                        {prod ? fmtCurrency(prod.precioVenta) : '—'}
                      </td>

                      {/* Costo */}
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {prod ? fmtCurrency(prod.costo) : '—'}
                      </td>

                      {/* Stock actual — columna más importante */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className={`text-base font-bold tabular-nums ${
                            st === 'normal'  ? 'text-emerald-600' :
                            st === 'bajo'    ? 'text-amber-600'   :
                            st === 'critico' ? 'text-red-600'     : 'text-slate-500'
                          }`}>
                            {fmtNum(e.cantidadActual)}
                          </span>
                        </div>
                      </td>

                      {/* Mínimo */}
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                        {fmtNum(e.cantidadMinima)}
                      </td>

                      {/* Valor inventario */}
                      <td className="px-4 py-3 text-right text-xs font-medium text-purple-600">
                        {valorInv !== null ? fmtCurrency(valorInv) : '—'}
                      </td>

                      {/* Estado badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                          {st === 'normal'  && <CheckCircle2 size={10} />}
                          {st === 'agotado' && <XCircle size={10} />}
                          {(st === 'bajo' || st === 'critico') && <AlertTriangle size={10} />}
                          {cfg.label}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`btn-detalle-exist-${e.idExistencia}`}
                            onClick={() => setDetalleItem(e)}
                            title="Ver detalle"
                            className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors text-muted-foreground"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            id={`btn-ajuste-exist-${e.idExistencia}`}
                            onClick={() => setAjusteItem(e)}
                            title="Ajuste rápido de stock"
                            className="p-1.5 rounded-md hover:bg-emerald-100 hover:text-emerald-700 transition-colors text-muted-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer tabla ──────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <span>
              Mostrando {Math.min(page * PAGE_SIZE + 1, filtered.length)}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span>Pág. {page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modales ──────────────────────────────────────── */}
      {detalleItem && (
        <DetalleModal
          existencia={detalleItem}
          productoMap={productoMap}
          onClose={() => setDetalleItem(null)}
        />
      )}

      {ajusteItem && (
        <AjusteModal
          existencia={ajusteItem}
          productoMap={productoMap}
          onClose={() => setAjusteItem(null)}
          onSaved={() => { setAjusteItem(null); cargarDatos(); }}
        />
      )}
    </div>
  );
}
