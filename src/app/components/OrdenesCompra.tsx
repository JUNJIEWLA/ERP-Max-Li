import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from '@floating-ui/react-dom';
import {
  Plus, X, Loader2, ShoppingCart, Search, ChevronDown, ChevronRight,
  Send, Ban, CheckCircle2, PackageCheck, Trash2,
  MoreVertical, Eye, Pencil, FileText, AlertCircle, Clock,
  ChevronLeft, LayoutGrid, ShieldCheck, DollarSign, Save, RotateCcw,
  Calendar, Building2, Package
} from 'lucide-react';
import { ordenesCompraApi, proveedoresApi, productosApi, almacenesApi, OrdenCompra, Proveedor, Producto, Almacen } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR:          'bg-slate-500/10 text-slate-600 border border-slate-500/20',
  ENVIADA:           'bg-blue-500/10 text-blue-600 border border-blue-500/20',
  RECEPCION_PARCIAL: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
  COMPLETADA:        'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  ANULADA:           'bg-rose-500/10 text-rose-600 border border-rose-500/20',
};



type LineaOrden = { idProducto: number; nombre: string; cantidad: number; precioUnitario: number; idAlmacen?: number | null };

/** Helper: formatea una fecha ISO como dd/MM/yyyy */
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Badge visual para días de retraso de la OC */
function RetrasoOcBadge({ diasRetraso }: { diasRetraso: number | null }) {
  if (diasRetraso === null || diasRetraso === undefined) return null;
  const pulse = diasRetraso <= 3;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 ${
      pulse ? 'animate-pulse' : ''
    }`}>
      <Clock size={11} />
      {diasRetraso === 0 ? 'Vence hoy' : `${diasRetraso}d retraso`}
    </span>
  );
}

/* ─── Dropdown menu por fila — Floating UI ─── */
interface RowMenuProps {
  orden: OrdenCompra;
  onVerDetalles: () => void;
  onEditar: () => void;
  onEnviar: () => void;
  onForzarCierre: () => void;
  onAnular: () => void;
  onGenerarReporte: () => void;
}

function RowMenu({ orden, onVerDetalles, onEditar, onEnviar, onForzarCierre, onAnular, onGenerarReporte }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, update } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const floating  = refs.floating.current;
      const reference = refs.reference.current as Element | null;
      if (
        floating  && !floating.contains(e.target as Node) &&
        reference && !reference.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, refs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    variant: 'default' | 'danger' | 'warning' | 'success' | 'info' = 'default'
  ) => {
    const colors: Record<string, string> = {
      default: 'text-foreground hover:bg-muted',
      danger:  'text-rose-600 hover:bg-rose-500/10',
      warning: 'text-amber-600 hover:bg-amber-500/10',
      success: 'text-emerald-600 hover:bg-emerald-500/10',
      info:    'text-blue-600 hover:bg-blue-500/10',
    };
    return (
      <button
        onClick={() => { onClick(); setOpen(false); }}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors font-medium ${colors[variant]}`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {label}
      </button>
    );
  };

  const canEdit   = orden.estado === 'ENVIADA';
  const canEnviar = orden.estado === 'BORRADOR';
  const canForzar = ['ENVIADA', 'RECEPCION_PARCIAL'].includes(orden.estado);
  const canAnular = ['BORRADOR', 'ENVIADA'].includes(orden.estado);
  const hasActions = canEnviar || canForzar || canAnular;

  const dropdown = open && createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex: 9999, width: 228 }}
      className="bg-card border border-border rounded-xl shadow-2xl p-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
      onAnimationEnd={update}
    >
      <div className="px-3 py-2 mb-1 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Orden de Compra</p>
        <p className="text-xs font-mono font-bold text-foreground">
          OC-{String(orden.idOrdenCompra).padStart(4, '0')}
        </p>
      </div>

      {menuItem(<Eye size={14} />,      'Ver detalles',    onVerDetalles)}
      {menuItem(<FileText size={14} />, 'Generar reporte', onGenerarReporte)}
      {canEdit && menuItem(<Pencil size={14} />, 'Editar orden', onEditar, 'info')}

      {hasActions && <div className="my-1.5 border-t border-border" />}
      {hasActions && (
        <p className="px-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones</p>
      )}
      {canEnviar && menuItem(<Send size={14} />,         'Enviar al proveedor', onEnviar,       'info')}
      {canForzar && menuItem(<PackageCheck size={14} />, 'Forzar cierre',       onForzarCierre, 'warning')}
      {canAnular && menuItem(<Ban size={14} />,          'Anular orden',        onAnular,       'danger')}
    </div>,
    document.body
  );

  return (
    <div className="flex justify-center">
      <button
        ref={refs.setReference}
        id={`btn-menu-${orden.idOrdenCompra}`}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`p-1.5 rounded-lg transition-all duration-150 ${
          open
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        }`}
        title="Más opciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {dropdown}
    </div>
  );
}

/* ─── Modal Ver Detalles (Completo) ────────────────────────────────────── */
function DetalleModal({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-bold">Orden de Compra</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              OC-{String(orden.idOrdenCompra).padStart(4, '0')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Info general */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Proveedor</p>
              <p className="font-semibold text-sm">{orden.nombreProveedor}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Total</p>
              <p className="font-bold text-sm text-foreground">{fmt(orden.total)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ESTADO_BADGE[orden.estado] ?? 'bg-muted'}`}>
                {orden.estado.replace('_', ' ')}
              </span>
            </div>

          </div>

          {/* Productos */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Productos</p>
            <div className="space-y-2">
              {orden.detalles.map(d => (
                <div key={d.idDetalleOrdenCompra} className="flex items-center justify-between bg-muted/30 rounded-xl px-3.5 py-2.5 text-sm border border-border">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{d.nombreProducto}</span>
                    <span className="text-[10px] text-muted-foreground">{d.nombreAlmacen ? `Destino: ${d.nombreAlmacen}` : 'Almacén no asignado'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs">
                    <span>{d.cantidadRecibida}/{d.cantidad} recibidos</span>
                    <span className="font-semibold text-foreground">{fmt(d.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
        <div className="p-4 border-t border-border flex justify-end bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────── */
export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 15;

  const [detalleOrden, setDetalleOrden] = useState<OrdenCompra | null>(null);

  const [showNueva, setShowNueva] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [idProveedorSel, setIdProveedorSel] = useState('');
  const [fechaAcordada, setFechaAcordada] = useState('');
  const [lineas, setLineas] = useState<LineaOrden[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');



  const [confirmAction, setConfirmAction] = useState<{ id: number; accion: 'anular' | 'forzar-cierre' } | null>(null);
  const [reporteToast, setReporteToast] = useState<string | null>(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordenesCompraApi.listar(page, PAGE_SIZE);
      setOrdenes(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements || data.content.length);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  const openNueva = async () => {
    setLineas([]);
    setIdProveedorSel('');
    setFechaAcordada('');
    setFormError('');
    try {
      const [pRes, prRes, almRes] = await Promise.all([
        proveedoresApi.listarActivos(),
        productosApi.listarActivos(),
        almacenesApi.listar(0, 100),
      ]);
      setProveedores(pRes.content);
      setProductos(prRes.content);
      setAlmacenes(almRes.content.filter(a => a.estado === 'ACTIVO'));
    } catch { setFormError('Error cargando datos'); }
    setShowNueva(true);
  };

  const addLinea = () =>
    setLineas(l => [...l, { idProducto: 0, nombre: '', cantidad: 1, precioUnitario: 0, idAlmacen: null }]);

  const removeLinea = (i: number) =>
    setLineas(l => l.filter((_, idx) => idx !== i));

  const setLineaProducto = (i: number, idProducto: number) => {
    const prod = productos.find(p => p.idProducto === idProducto);
    setLineas(l => l.map((ln, idx) => idx === i
      ? { ...ln, idProducto, nombre: prod?.nombre ?? '', precioUnitario: prod?.costo ?? 0 }
      : ln));
  };

  const totalLineas = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);

  const handleCrear = async () => {
    if (!idProveedorSel) { setFormError('Selecciona un proveedor'); return; }
    if (lineas.length === 0) { setFormError('Agrega al menos un producto'); return; }
    if (lineas.some(l => !l.idProducto || l.cantidad < 1 || l.precioUnitario <= 0))
      { setFormError('Completa todos los productos correctamente'); return; }
    setSaving(true); setFormError('');
    try {
      await ordenesCompraApi.crear({
        idProveedor: Number(idProveedorSel),
        fechaLlegadaAcordada: fechaAcordada || null,
        detalles: lineas.map(l => ({
          idProducto: l.idProducto,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          idAlmacen: l.idAlmacen || null
        })),
      });
      setShowNueva(false);
      fetchOrdenes();
    } catch (err: any) { setFormError(err.message || 'Error al crear'); }
    finally { setSaving(false); }
  };

  const handleEstado = async (id: number, accion: string) => {
    try {
      if (accion === 'enviar') await ordenesCompraApi.enviar(id);
      else if (accion === 'anular') await ordenesCompraApi.anular(id);
      else if (accion === 'forzar-cierre') await ordenesCompraApi.forzarCierre(id);
      fetchOrdenes();
    } finally { setConfirmAction(null); }
  };

  const handleGenerarReporte = (orden: OrdenCompra) => {
    setReporteToast(`Generando reporte para OC-${String(orden.idOrdenCompra).padStart(4, '0')}...`);
    setTimeout(() => setReporteToast(null), 3000);
  };

  const filtered = ordenes.filter(o =>
    o.nombreProveedor.toLowerCase().includes(search.toLowerCase()) ||
    String(o.idOrdenCompra).includes(search)
  );

  const activas = ordenes.filter(o => ['ENVIADA', 'RECEPCION_PARCIAL'].includes(o.estado)).length;
  const totalMonto = ordenes.reduce((acc, o) => acc + (o.total || 0), 0);

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Toast reporte */}
      {reporteToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <Loader2 size={16} className="animate-spin text-primary" />
          {reporteToast}
        </div>
      )}

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <ShoppingCart size={22} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Órdenes de Compra</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión, emisión y seguimiento de compras a proveedores</p>
            </div>
          </div>
          <button
            id="btn-nueva-orden"
            onClick={openNueva}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all font-semibold text-sm shadow-sm shadow-blue-600/30 hover:shadow-md hover:shadow-blue-600/20 hover:-translate-y-px"
          >
            <Plus size={16} /> Nueva Orden
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-lg"><LayoutGrid size={18} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total órdenes de compra</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-lg"><ShieldCheck size={18} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{activas}</p>
              <p className="text-xs text-muted-foreground">Órdenes activas en tránsito</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><DollarSign size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{fmt(totalMonto)}</p>
              <p className="text-xs text-muted-foreground">Monto total ordenado</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/50">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por proveedor o #orden..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <p className="text-sm text-muted-foreground">Cargando órdenes de compra...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><ShoppingCart size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron órdenes de compra</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Llegada / Retraso</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <React.Fragment key={o.idOrdenCompra}>
                      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetalleOrden(detalleOrden?.idOrdenCompra === o.idOrdenCompra ? null : o)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                          >
                            {detalleOrden?.idOrdenCompra === o.idOrdenCompra
                              ? <ChevronDown size={15} />
                              : <ChevronRight size={15} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                            OC-{String(o.idOrdenCompra).padStart(4, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">{o.nombreProveedor}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          {fmt(o.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ESTADO_BADGE[o.estado] ?? 'bg-muted text-muted-foreground'}`}>
                            {o.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {o.diasRetraso !== null && o.diasRetraso !== undefined ? (
                            <RetrasoOcBadge diasRetraso={o.diasRetraso} />
                          ) : o.fechaLlegadaAcordada ? (
                            <span className="text-xs text-emerald-600 font-medium">{fmtDate(o.fechaLlegadaAcordada)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <RowMenu
                            orden={o}
                            onVerDetalles={() => setDetalleOrden(o)}
                            onEditar={() => {}}
                            onEnviar={() => handleEstado(o.idOrdenCompra, 'enviar')}

                            onForzarCierre={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'forzar-cierre' })}
                            onAnular={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'anular' })}
                            onGenerarReporte={() => handleGenerarReporte(o)}
                          />
                        </td>
                      </tr>

                      {/* Expand inline */}
                      {detalleOrden?.idOrdenCompra === o.idOrdenCompra && (
                        <tr key={`exp-${o.idOrdenCompra}`} className="bg-muted/15 border-b border-border">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package size={13} /> Productos de la Orden
                                </p>
                                <div className="space-y-1.5">
                                  {o.detalles.map(d => (
                                    <div key={d.idDetalleOrdenCompra} className="flex items-center justify-between text-xs bg-card rounded-xl px-3.5 py-2 border border-border">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{d.nombreProducto}</span>
                                        <span className="text-[10px] text-muted-foreground">{d.nombreAlmacen ? `Destino: ${d.nombreAlmacen}` : 'Almacén no asignado'}</span>
                                      </div>
                                      <div className="flex items-center gap-4 text-muted-foreground">
                                        <span>{d.cantidadRecibida}/{d.cantidad} recibidos</span>
                                        <span className="font-semibold font-mono text-foreground">{fmt(d.subtotal)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/50 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong> — {totalElements} registros</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-blue-600 text-white' : 'hover:bg-muted border border-border'}`}>{pg + 1}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Ver Detalles */}
      {detalleOrden && (
        <DetalleModal orden={detalleOrden} onClose={() => setDetalleOrden(null)} />
      )}

      {/* Modal Nueva Orden */}
      {showNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <ShoppingCart size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Nueva Orden de Compra</h3>
                <p className="text-xs text-muted-foreground">Genera una solicitud formal de productos a un suplidor</p>
              </div>
              <button onClick={() => setShowNueva(false)} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Proveedor <span className="text-rose-500">*</span></label>
                <select id="sel-proveedor-orden" value={idProveedorSel} onChange={e => setIdProveedorSel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => (
                    <option key={p.idProveedor} value={p.idProveedor}>{p.nombreEmpresa}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Fecha de llegada acordada <span className="text-xs font-normal text-muted-foreground">(opcional)</span></label>
                <input
                  id="input-fecha-acordada"
                  type="date"
                  value={fechaAcordada}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setFechaAcordada(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <p className="text-xs text-muted-foreground mt-1">El sistema generará alertas automáticas si la mercancía no se recibe para esta fecha.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold">Productos de la Orden <span className="text-rose-500">*</span></label>
                  <button onClick={addLinea}
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline bg-blue-500/10 px-2.5 py-1 rounded-lg">
                    <Plus size={13} /> Agregar producto
                  </button>
                </div>
                {lineas.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-border rounded-xl bg-muted/20">
                    Haz clic en "Agregar producto" para añadir líneas a la orden
                  </div>
                )}
                <div className="space-y-2">
                  {lineas.map((ln, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/30 border border-border rounded-xl p-3">
                      <div className="col-span-4">
                        <select value={ln.idProducto} onChange={e => setLineaProducto(i, Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none">
                          <option value={0}>Seleccionar producto...</option>
                          {productos.map(p => <option key={p.idProducto} value={p.idProducto}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <select value={ln.idAlmacen || ''}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, idAlmacen: e.target.value ? Number(e.target.value) : null } : x))}
                          className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none">
                          <option value="">Almacén (opcional)</option>
                          {almacenes.map(a => <option key={a.idAlmacen} value={a.idAlmacen}>{a.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={1} value={ln.cantidad}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, cantidad: parseInt(e.target.value) || 1 } : x))}
                          className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs text-center focus:outline-none" placeholder="Cant." />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} step={0.01} value={ln.precioUnitario}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, precioUnitario: parseFloat(e.target.value) || 0 } : x))}
                          className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none" placeholder="Precio" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeLinea(i)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {lineas.length > 0 && (
                  <div className="flex justify-end mt-3 text-sm font-bold text-foreground bg-muted/40 p-3 rounded-xl border border-border">
                    Total Estimado: <span className="text-blue-600 font-mono ml-2">{fmt(totalLineas)}</span>
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/8 border border-rose-500/20 px-3.5 py-2.5 rounded-xl">
                  <AlertCircle size={15} className="flex-shrink-0" /> {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowNueva(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">
                <RotateCcw size={14} /> Cancelar
              </button>
              <button id="btn-crear-orden" onClick={handleCrear} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all text-sm font-semibold disabled:opacity-60 shadow-sm shadow-blue-600/30">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${confirmAction.accion === 'anular' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
                {confirmAction.accion === 'anular'
                  ? <Ban size={22} className="text-rose-500" />
                  : <CheckCircle2 size={22} className="text-amber-600" />}
              </div>
              <div>
                <h3 className="font-bold text-foreground">
                  {confirmAction.accion === 'anular' ? '¿Anular orden?' : '¿Forzar cierre?'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">OC-{String(confirmAction.id).padStart(4, '0')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction.accion === 'anular'
                ? 'La orden pasará a estado ANULADA. Esta acción no se puede deshacer.'
                : 'La orden se cerrará como COMPLETADA aunque haya mercancía pendiente de recibir.'}
            </p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button id="btn-confirmar-accion"
                onClick={() => handleEstado(confirmAction.id, confirmAction.accion)}
                className={`px-4 py-2 rounded-xl text-white transition-colors text-sm font-semibold ${
                  confirmAction.accion === 'anular' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {confirmAction.accion === 'anular' ? 'Sí, Anular' : 'Sí, Forzar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
