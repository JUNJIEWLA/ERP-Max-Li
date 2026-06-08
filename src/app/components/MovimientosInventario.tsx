import { useEffect, useState, useCallback } from 'react';
import {
  ArrowRightLeft, RefreshCw, Search, X, Eye, Plus,
  Loader2, AlertTriangle, Warehouse, Package, ChevronRight,
  CheckCircle2, Trash2
} from 'lucide-react';
import {
  movimientosApi, almacenesApi, productosApi, existenciasApi,
  type MovimientoInventario, type Almacen, type Producto, type Existencia
} from '../../imports/api';

// ── Helpers ──────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtNum = (v: number) => v.toLocaleString('es-DO');

// ── Modal de Detalle ─────────────────────────────────────

function DetalleMovModal({ mov, onClose }: { mov: MovimientoInventario; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Eye size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Detalle de Movimiento #{mov.idMovimiento}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info del movimiento */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-bold mt-0.5">
                <span className="inline-flex items-center gap-1.5 text-blue-700">
                  <ArrowRightLeft size={14} /> {mov.tipo}
                </span>
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Estado</p>
              <p className="font-bold mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  mov.estado === 'COMPLETADO'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  {mov.estado === 'COMPLETADO' && <CheckCircle2 size={10} />}
                  {mov.estado}
                </span>
              </p>
            </div>
          </div>

          {/* Almacenes */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl px-4 py-3 border border-blue-100">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-1">Origen</p>
              <p className="font-bold text-sm text-blue-700">{mov.almacenOrigenNombre || '—'}</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-1">Destino</p>
              <p className="font-bold text-sm text-emerald-700">{mov.almacenDestinoNombre || '—'}</p>
            </div>
          </div>

          {/* Detalles */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Responsable</p>
              <p className="font-semibold mt-0.5">{mov.usuarioResponsable}</p>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="font-semibold mt-0.5 text-xs">{fmtDate(mov.fechaMovimiento)}</p>
            </div>
          </div>

          {mov.referencia && (
            <div className="bg-muted/30 rounded-xl px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="font-semibold mt-0.5">{mov.referencia}</p>
            </div>
          )}

          {mov.observacion && (
            <div className="bg-muted/30 rounded-xl px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground">Observación</p>
              <p className="mt-0.5">{mov.observacion}</p>
            </div>
          )}

          {/* Tabla de productos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Productos transferidos ({mov.detalles.length})
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Producto</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {mov.detalles.map((d) => (
                    <tr key={d.idDetalleMovimiento} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.productoSku}</td>
                      <td className="px-3 py-2">{d.productoNombre}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{fmtNum(d.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

// ── Línea de producto en transferencia ────────────────────

interface LineaProducto {
  idProducto: number;
  nombre: string;
  sku: string;
  cantidad: number;
  stockDisponible: number;
}

// ── Modal de Nueva Transferencia ─────────────────────────

function TransferenciaModal({ almacenes, onClose, onSaved }: {
  almacenes: Almacen[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idAlmacenOrigen, setIdAlmacenOrigen] = useState<string>('');
  const [idAlmacenDestino, setIdAlmacenDestino] = useState<string>('');
  const [referencia, setReferencia] = useState('');
  const [observacion, setObservacion] = useState('');
  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Estado para búsqueda de productos
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([]);
  const [existenciasOrigen, setExistenciasOrigen] = useState<Existencia[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);

  // Cargar productos y existencias cuando se selecciona almacén origen
  useEffect(() => {
    if (!idAlmacenOrigen) {
      setProductosDisponibles([]);
      setExistenciasOrigen([]);
      setLineas([]);
      return;
    }

    const cargar = async () => {
      setLoadingProductos(true);
      try {
        const [prodsPage, existPage] = await Promise.all([
          productosApi.listarActivos(0, 500),
          existenciasApi.listarPorAlmacen(Number(idAlmacenOrigen), 0, 500),
        ]);
        setProductosDisponibles(prodsPage.content);
        setExistenciasOrigen(existPage.content);
      } catch {
        setProductosDisponibles([]);
        setExistenciasOrigen([]);
      } finally {
        setLoadingProductos(false);
      }
    };
    cargar();
    setLineas([]); // reset líneas al cambiar origen
  }, [idAlmacenOrigen]);

  const getStockForProduct = (idProducto: number) => {
    const ex = existenciasOrigen.find(e => e.idProducto === idProducto);
    return ex ? ex.cantidadActual : 0;
  };

  const agregarProducto = (prod: Producto) => {
    if (lineas.some(l => l.idProducto === prod.idProducto)) return;
    const stock = getStockForProduct(prod.idProducto);
    if (stock <= 0) {
      setError(`"${prod.nombre}" no tiene stock disponible en el almacén de origen.`);
      return;
    }
    setLineas(prev => [...prev, {
      idProducto: prod.idProducto,
      nombre: prod.nombre,
      sku: prod.sku,
      cantidad: 1,
      stockDisponible: stock,
    }]);
    setProductoBusqueda('');
    setError('');
  };

  const actualizarCantidad = (idx: number, cantidad: number) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, cantidad: Math.max(1, Math.min(cantidad, l.stockDisponible)) } : l));
  };

  const eliminarLinea = (idx: number) => {
    setLineas(prev => prev.filter((_, i) => i !== idx));
  };

  const productosFiltrados = productosDisponibles.filter(p => {
    if (!productoBusqueda) return false;
    const q = productoBusqueda.toLowerCase();
    const enLista = lineas.some(l => l.idProducto === p.idProducto);
    return !enLista && (
      p.nombre.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  const handleSubmit = async () => {
    setError('');
    if (!idAlmacenOrigen) { setError('Selecciona el almacén de origen.'); return; }
    if (!idAlmacenDestino) { setError('Selecciona el almacén de destino.'); return; }
    if (idAlmacenOrigen === idAlmacenDestino) { setError('El origen y destino no pueden ser el mismo almacén.'); return; }
    if (lineas.length === 0) { setError('Agrega al menos un producto a la transferencia.'); return; }

    for (const l of lineas) {
      if (l.cantidad > l.stockDisponible) {
        setError(`"${l.nombre}" solo tiene ${l.stockDisponible} unidades disponibles.`);
        return;
      }
    }

    setSaving(true);
    try {
      await movimientosApi.crearTransferencia({
        idAlmacenOrigen: Number(idAlmacenOrigen),
        idAlmacenDestino: Number(idAlmacenDestino),
        referencia: referencia || undefined,
        observacion: observacion || undefined,
        detalles: lineas.map(l => ({ idProducto: l.idProducto, cantidad: l.cantidad })),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al crear la transferencia.');
    } finally {
      setSaving(false);
    }
  };

  const totalProductos = lineas.reduce((s, l) => s + l.cantidad, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Nueva Transferencia de Inventario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Almacenes origen/destino */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Almacén Origen</label>
              <select
                id="sel-almacen-origen"
                value={idAlmacenOrigen}
                onChange={e => setIdAlmacenOrigen(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                {almacenes.map(a => (
                  <option key={a.idAlmacen} value={String(a.idAlmacen)} disabled={String(a.idAlmacen) === idAlmacenDestino}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-shrink-0 mt-5">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ChevronRight size={20} className="text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Almacén Destino</label>
              <select
                id="sel-almacen-destino"
                value={idAlmacenDestino}
                onChange={e => setIdAlmacenDestino(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                {almacenes.map(a => (
                  <option key={a.idAlmacen} value={String(a.idAlmacen)} disabled={String(a.idAlmacen) === idAlmacenOrigen}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador de productos */}
          {idAlmacenOrigen && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Agregar productos</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="input-buscar-producto-transferencia"
                  type="text"
                  placeholder="Buscar por nombre, SKU o código de barras…"
                  value={productoBusqueda}
                  onChange={e => setProductoBusqueda(e.target.value)}
                  disabled={loadingProductos}
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
                {loadingProductos && (
                  <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Dropdown de resultados */}
              {productosFiltrados.length > 0 && (
                <div className="mt-1 border border-border rounded-xl bg-background shadow-lg max-h-48 overflow-y-auto">
                  {productosFiltrados.map(p => {
                    const stock = getStockForProduct(p.idProducto);
                    return (
                      <button
                        key={p.idProducto}
                        onClick={() => agregarProducto(p)}
                        disabled={stock <= 0}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0 disabled:opacity-40"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          stock > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {stock > 0 ? `${stock} disp.` : 'Sin stock'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tabla de líneas */}
          {lineas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Productos a transferir ({lineas.length})
                </p>
                <span className="text-xs font-bold text-blue-600">{totalProductos} unidades total</span>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Producto</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Disponible</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Cantidad</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, idx) => (
                      <tr key={l.idProducto} className="border-b border-border/50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-sm">{l.nombre}</p>
                          <p className="text-xs text-muted-foreground font-mono">{l.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {fmtNum(l.stockDisponible)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={l.stockDisponible}
                            value={l.cantidad}
                            onChange={e => actualizarCantidad(idx, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => eliminarLinea(idx)}
                            className="p-1 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Campos opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Referencia (opcional)</label>
              <input
                type="text"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                placeholder="Ej: OC-001, Req-2025"
                maxLength={100}
                className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Observación (opcional)</label>
              <input
                type="text"
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                placeholder="Motivo de la transferencia"
                maxLength={500}
                className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || lineas.length === 0 || !idAlmacenOrigen || !idAlmacenDestino}
            className="flex-1 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
            {saving ? 'Procesando…' : `Transferir ${totalProductos} unidades`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────

export default function MovimientosInventario() {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [almacenFiltro, setAlmacenFiltro] = useState<string>('');

  // Paginación
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 15;

  // Modales
  const [detalleItem, setDetalleItem] = useState<MovimientoInventario | null>(null);
  const [showTransferencia, setShowTransferencia] = useState(false);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [movPage, almPage] = await Promise.all([
        almacenFiltro
          ? movimientosApi.listarPorAlmacen(Number(almacenFiltro), page, PAGE_SIZE)
          : movimientosApi.listar(page, PAGE_SIZE),
        almacenesApi.listar(0, 100),
      ]);
      setMovimientos(movPage.content);
      setTotalPages(movPage.totalPages);
      setAlmacenes(almPage.content.filter(a => a.estado === 'ACTIVO'));
    } catch (e: any) {
      setError(e.message || 'Error al cargar los movimientos.');
    } finally {
      setLoading(false);
    }
  }, [page, almacenFiltro]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  useEffect(() => { setPage(0); }, [almacenFiltro]);

  // Filtro local por texto
  const filtered = movimientos.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.almacenOrigenNombre || '').toLowerCase().includes(q) ||
      (m.almacenDestinoNombre || '').toLowerCase().includes(q) ||
      (m.referencia || '').toLowerCase().includes(q) ||
      m.usuarioResponsable.toLowerCase().includes(q) ||
      m.detalles.some(d => d.productoNombre.toLowerCase().includes(q) || d.productoSku.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft size={22} className="text-blue-500" />
            Movimientos de Inventario
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historial de transferencias entre almacenes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            id="btn-nueva-transferencia"
            onClick={() => setShowTransferencia(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
          >
            <Plus size={15} />
            Nueva Transferencia
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Movimientos</p>
            <p className="text-2xl font-bold mt-1">{loading ? '—' : filtered.length}</p>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <ArrowRightLeft size={20} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Transferencias</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {loading ? '—' : filtered.filter(m => m.tipo === 'TRANSFERENCIA').length}
            </p>
          </div>
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completados</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              {loading ? '—' : filtered.filter(m => m.estado === 'COMPLETADO').length}
            </p>
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Almacenes Activos</p>
            <p className="text-2xl font-bold mt-1 text-purple-600">
              {loading ? '—' : almacenes.length}
            </p>
          </div>
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <Warehouse size={20} />
          </div>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="input-buscar-movimientos"
            type="text"
            placeholder="Buscar por almacén, producto, referencia…"
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

        <div className="flex items-center gap-1.5">
          <Warehouse size={14} className="text-muted-foreground" />
          <select
            id="filtro-almacen-movimientos"
            value={almacenFiltro}
            onChange={e => setAlmacenFiltro(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">Todos los almacenes</option>
            {almacenes.map(a => <option key={a.idAlmacen} value={String(a.idAlmacen)}>{a.nombre}</option>)}
          </select>
        </div>

        {(search || almacenFiltro) && (
          <button
            onClick={() => { setSearch(''); setAlmacenFiltro(''); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabla de Movimientos ───────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  #ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Origen → Destino
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Productos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Responsable
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-muted-foreground">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2" />
                    Cargando movimientos…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-muted-foreground">
                    <ArrowRightLeft size={36} className="mx-auto mb-2 opacity-30" />
                    <p>No se encontraron movimientos.</p>
                    <p className="text-xs mt-1">Crea una transferencia para comenzar.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const totalUnidades = m.detalles.reduce((s, d) => s + d.cantidad, 0);
                  return (
                    <tr
                      key={m.idMovimiento}
                      className="border-b border-border/60 transition-colors hover:bg-muted/20"
                    >
                      {/* ID */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        MOV-{String(m.idMovimiento).padStart(4, '0')}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          <ArrowRightLeft size={10} />
                          {m.tipo}
                        </span>
                      </td>

                      {/* Origen → Destino */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-medium text-blue-700 max-w-[120px] truncate" title={m.almacenOrigenNombre || ''}>
                            {m.almacenOrigenNombre || '—'}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-emerald-700 max-w-[120px] truncate" title={m.almacenDestinoNombre || ''}>
                            {m.almacenDestinoNombre || '—'}
                          </span>
                        </div>
                        {m.referencia && (
                          <p className="text-xs text-muted-foreground mt-0.5">Ref: {m.referencia}</p>
                        )}
                      </td>

                      {/* Productos */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-base font-bold text-blue-700">{totalUnidades}</span>
                          <span className="text-xs text-muted-foreground">{m.detalles.length} ítem{m.detalles.length !== 1 ? 's' : ''}</span>
                        </div>
                      </td>

                      {/* Responsable */}
                      <td className="px-4 py-3 text-sm">{m.usuarioResponsable}</td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(m.fechaMovimiento)}</td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          m.estado === 'COMPLETADO'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {m.estado === 'COMPLETADO' && <CheckCircle2 size={10} />}
                          {m.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-center">
                        <button
                          id={`btn-detalle-mov-${m.idMovimiento}`}
                          onClick={() => setDetalleItem(m)}
                          title="Ver detalle"
                          className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors text-muted-foreground"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ──────────────────────────────────────── */}
      {detalleItem && (
        <DetalleMovModal
          mov={detalleItem}
          onClose={() => setDetalleItem(null)}
        />
      )}

      {showTransferencia && (
        <TransferenciaModal
          almacenes={almacenes}
          onClose={() => setShowTransferencia(false)}
          onSaved={() => { setShowTransferencia(false); cargarDatos(); }}
        />
      )}
    </div>
  );
}
