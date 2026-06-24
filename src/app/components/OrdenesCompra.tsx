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
  Send, Ban, CheckCircle2, CreditCard, PackageCheck, Trash2,
  MoreVertical, Eye, Pencil, FileText, AlertTriangle, Clock
} from 'lucide-react';
import { ordenesCompraApi, proveedoresApi, productosApi, almacenesApi, OrdenCompra, Proveedor, Producto, Almacen } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR:          'bg-slate-500/15 text-slate-600',
  ENVIADA:           'bg-blue-500/15 text-blue-600',
  RECEPCION_PARCIAL: 'bg-amber-500/15 text-amber-700',
  COMPLETADA:        'bg-green-500/15 text-green-600',
  ANULADA:           'bg-rose-500/15 text-rose-600',
};

const PAGO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-rose-500/15 text-rose-600',
  PARCIAL:   'bg-amber-500/15 text-amber-700',
  SALDADO:   'bg-green-500/15 text-green-600',
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 ${
      pulse ? 'animate-pulse' : ''
    }`}>
      <Clock size={11} />
      {diasRetraso === 0 ? 'Vence hoy' : `${diasRetraso}d retraso`}
    </span>
  );
}

/* ─── Dropdown menu por fila — Floating UI (portal + auto-posicionamiento) ─── */
interface RowMenuProps {
  orden: OrdenCompra;
  onVerDetalles: () => void;
  onEditar: () => void;
  onEnviar: () => void;
  onPago: () => void;
  onForzarCierre: () => void;
  onAnular: () => void;
  onGenerarReporte: () => void;
}

function RowMenu({ orden, onVerDetalles, onEditar, onEnviar, onPago, onForzarCierre, onAnular, onGenerarReporte }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  // useFloating: portal con strategy 'fixed' → coordenadas relativas al viewport
  const { refs, floatingStyles, update } = useFloating({
    open,
    strategy: 'fixed',                 // CRÍTICO: portal en body requiere fixed
    placement: 'bottom-end',
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Cierra al hacer clic fuera
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

  // Cierra en Escape
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
      success: 'text-green-600 hover:bg-green-500/10',
      info:    'text-blue-600 hover:bg-blue-500/10',
    };
    return (
      <button
        onClick={() => { onClick(); setOpen(false); }}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors ${colors[variant]}`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {label}
      </button>
    );
  };

  const canEdit   = orden.estado === 'ENVIADA';
  const canEnviar = orden.estado === 'BORRADOR';
  const canPago   = ['ENVIADA', 'RECEPCION_PARCIAL'].includes(orden.estado) && orden.estadoPago !== 'SALDADO';
  const canForzar = ['ENVIADA', 'RECEPCION_PARCIAL'].includes(orden.estado);
  const canAnular = ['BORRADOR', 'ENVIADA'].includes(orden.estado);
  const hasActions = canEnviar || canPago || canForzar || canAnular;

  const dropdown = open && createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex: 9999, width: 228 }}
      className="bg-card border border-border rounded-xl shadow-2xl p-1.5 ring-1 ring-black/5"
      onAnimationEnd={update}         // recalcula tras la animación
    >
      {/* Cabecera de contexto */}
      <div className="px-3 py-2 mb-1 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Orden de Compra</p>
        <p className="text-xs font-mono font-bold text-foreground">
          OC-{String(orden.idOrdenCompra).padStart(4, '0')}
        </p>
      </div>

      {/* Acciones siempre disponibles */}
      {menuItem(<Eye size={14} />,      'Ver detalles',    onVerDetalles)}
      {menuItem(<FileText size={14} />, 'Generar reporte', onGenerarReporte)}
      {canEdit && menuItem(<Pencil size={14} />, 'Editar orden', onEditar, 'info')}

      {/* Acciones de estado (separadas) */}
      {hasActions && <div className="my-1.5 border-t border-border" />}
      {hasActions && (
        <p className="px-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones</p>
      )}
      {canEnviar && menuItem(<Send size={14} />,         'Enviar al proveedor', onEnviar,       'info')}
      {canPago   && menuItem(<CreditCard size={14} />,   'Registrar pago',      onPago,         'success')}
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
        onClick={() => setOpen(v => !v)}
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

/* ─── Modal Ver Detalles ──────────────────────────────────────────────── */
function DetalleModal({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border max-h-[85vh] flex flex-col">
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
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Proveedor</p>
              <p className="font-semibold text-sm">{orden.nombreProveedor}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Total</p>
              <p className="font-bold text-sm">{fmt(orden.total)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Estado</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[orden.estado] ?? 'bg-muted'}`}>
                {orden.estado.replace('_', ' ')}
              </span>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Pago</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAGO_BADGE[orden.estadoPago] ?? 'bg-muted'}`}>
                {orden.estadoPago}
              </span>
            </div>
          </div>

          {/* Productos */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Productos</p>
            <div className="space-y-1.5">
              {orden.detalles.map(d => (
                <div key={d.idDetalleOrdenCompra} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5 text-sm border border-border">
                  <div className="flex flex-col">
                    <span className="font-medium">{d.nombreProducto}</span>
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

          {/* Pagos */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagos registrados</p>
            {orden.pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin pagos aún</p>
            ) : (
              <div className="space-y-1.5">
                {orden.pagos.map(p => (
                  <div key={p.idPagoProveedor} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5 border border-border">
                    <div>
                      <span className="font-semibold text-sm">{fmt(p.montoPagado)}</span>
                      <span className="text-xs text-muted-foreground ml-2">• {p.metodo}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.fecha).toLocaleDateString('es-DO')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Balance pendiente:</p>
            <p className={`font-bold text-sm ${orden.balancePendiente > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {fmt(orden.balancePendiente)}
            </p>
          </div>
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
  const PAGE_SIZE = 15;

  // Modal detalle
  const [detalleOrden, setDetalleOrden] = useState<OrdenCompra | null>(null);

  // Modal nueva orden
  const [showNueva, setShowNueva] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [idProveedorSel, setIdProveedorSel] = useState('');
  const [fechaAcordada, setFechaAcordada] = useState('');
  const [lineas, setLineas] = useState<LineaOrden[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal pago
  const [pagoOrdenId, setPagoOrdenId] = useState<number | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('TRANSFERENCIA');
  const [pagoRef, setPagoRef] = useState('');
  const [savingPago, setSavingPago] = useState(false);
  const [pagoError, setPagoError] = useState('');

  // Confirm action
  const [confirmAction, setConfirmAction] = useState<{ id: number; accion: 'anular' | 'forzar-cierre' } | null>(null);

  // Toast de reporte
  const [reporteToast, setReporteToast] = useState<string | null>(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordenesCompraApi.listar(page, PAGE_SIZE);
      setOrdenes(data.content);
      setTotalPages(data.totalPages);
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

  const handlePago = async () => {
    const monto = parseFloat(pagoMonto);
    if (!pagoOrdenId || isNaN(monto) || monto <= 0) { setPagoError('Ingresa un monto válido'); return; }
    setSavingPago(true); setPagoError('');
    try {
      await ordenesCompraApi.registrarPago(pagoOrdenId, {
        montoPagado: monto,
        metodo: pagoMetodo,
        numeroReferencia: pagoRef || undefined,
      });
      setPagoOrdenId(null);
      fetchOrdenes();
    } catch (err: any) { setPagoError(err.message || 'Error al registrar pago'); }
    finally { setSavingPago(false); }
  };

  const openPago = (id: number) => {
    setPagoOrdenId(id); setPagoMonto(''); setPagoMetodo('TRANSFERENCIA'); setPagoRef(''); setPagoError('');
  };

  const handleGenerarReporte = (orden: OrdenCompra) => {
    // Placeholder: muestra un toast elegante
    setReporteToast(`Generando reporte para OC-${String(orden.idOrdenCompra).padStart(4, '0')}...`);
    setTimeout(() => setReporteToast(null), 3000);
  };

  const filtered = ordenes.filter(o =>
    o.nombreProveedor.toLowerCase().includes(search.toLowerCase()) ||
    String(o.idOrdenCompra).includes(search)
  );

  return (
    <div className="p-6 space-y-6">

      {/* Keyframe para el menú portal */}
      <style>{`
        @keyframes rowMenuIn {
          from { opacity: 0; transform: scale(.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)  translateY(0); }
        }
      `}</style>

      {/* Toast reporte */}
      {reporteToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 text-sm font-medium animate-in">
          <Loader2 size={16} className="animate-spin text-primary" />
          {reporteToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart size={26} className="text-primary" /> Órdenes de Compra
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión y seguimiento de órdenes con proveedores</p>
        </div>
        <button id="btn-nueva-orden" onClick={openNueva}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-sm">
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por proveedor o #orden..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay órdenes de compra</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground w-8"></th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Pago</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Llegada / Retraso</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-16">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => (
                <React.Fragment key={o.idOrdenCompra}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          // Expandir fila: usamos el modal de detalles directamente al hacer clic en la flecha
                          setDetalleOrden(detalleOrden?.idOrdenCompra === o.idOrdenCompra ? null : o);
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                        {detalleOrden?.idOrdenCompra === o.idOrdenCompra
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">OC-{String(o.idOrdenCompra).padStart(4, '0')}</td>
                    <td className="px-4 py-3 font-medium">{o.nombreProveedor}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(o.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[o.estado] ?? 'bg-muted text-muted-foreground'}`}>
                        {o.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAGO_BADGE[o.estadoPago] ?? 'bg-muted text-muted-foreground'}`}>
                        {o.estadoPago}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.diasRetraso !== null && o.diasRetraso !== undefined ? (
                        <RetrasoOcBadge diasRetraso={o.diasRetraso} />
                      ) : o.fechaLlegadaAcordada ? (
                        <span className="text-xs text-emerald-600 font-medium">{fmtDate(o.fechaLlegadaAcordada)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${o.balancePendiente > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {fmt(o.balancePendiente)}
                    </td>
                    <td className="px-4 py-3">
                      <RowMenu
                        orden={o}
                        onVerDetalles={() => setDetalleOrden(o)}
                        onEditar={() => {/* TODO: abrir modal de edición */ }}
                        onEnviar={() => handleEstado(o.idOrdenCompra, 'enviar')}
                        onPago={() => openPago(o.idOrdenCompra)}
                        onForzarCierre={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'forzar-cierre' })}
                        onAnular={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'anular' })}
                        onGenerarReporte={() => handleGenerarReporte(o)}
                      />
                    </td>
                  </tr>

                  {/* Fila expandida inline (solo productos y pagos resumidos) */}
                  {detalleOrden?.idOrdenCompra === o.idOrdenCompra && (
                    <tr key={`exp-${o.idOrdenCompra}`} className="bg-muted/20">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Productos</p>
                            <div className="space-y-1">
                              {o.detalles.map(d => (
                                <div key={d.idDetalleOrdenCompra} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2 border border-border">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{d.nombreProducto}</span>
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
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Pagos registrados</p>
                            {o.pagos.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">Sin pagos aún</p>
                            ) : (
                              <div className="space-y-1">
                                {o.pagos.map(p => (
                                  <div key={p.idPagoProveedor} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2 border border-border">
                                    <div>
                                      <span className="font-medium">{fmt(p.montoPagado)}</span>
                                      <span className="text-xs text-muted-foreground ml-2">• {p.metodo}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(p.fecha).toLocaleDateString('es-DO')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">Anterior</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">Siguiente</button>
          </div>
        </div>
      )}

      {/* Modal Ver Detalles (popup completo) */}
      {detalleOrden && (
        <DetalleModal orden={detalleOrden} onClose={() => setDetalleOrden(null)} />
      )}

      {/* Modal Nueva Orden */}
      {showNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold">Nueva Orden de Compra</h3>
              <button onClick={() => setShowNueva(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor <span className="text-rose-500">*</span></label>
                <select id="sel-proveedor-orden" value={idProveedorSel} onChange={e => setIdProveedorSel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => (
                    <option key={p.idProveedor} value={p.idProveedor}>{p.nombreEmpresa}</option>
                  ))}
                </select>
              </div>

              {/* Fecha acordada */}
              <div>
                <label className="block text-sm font-medium mb-1">Fecha de llegada acordada <span className="text-xs text-muted-foreground">(opcional)</span></label>
                <input
                  id="input-fecha-acordada"
                  type="date"
                  value={fechaAcordada}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setFechaAcordada(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-xs text-muted-foreground mt-1">El sistema generará alertas en el buzón si la mercancía no llega antes de esta fecha.</p>
              </div>

              {/* Líneas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Productos <span className="text-rose-500">*</span></label>
                  <button onClick={addLinea}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus size={13} /> Agregar producto
                  </button>
                </div>
                {lineas.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">
                    Haz clic en "Agregar producto" para comenzar
                  </p>
                )}
                <div className="space-y-2">
                  {lineas.map((ln, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-lg p-3">
                      <div className="col-span-4">
                        <select value={ln.idProducto} onChange={e => setLineaProducto(i, Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                          <option value={0}>Seleccionar producto...</option>
                          {productos.map(p => <option key={p.idProducto} value={p.idProducto}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <select value={ln.idAlmacen || ''}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, idAlmacen: e.target.value ? Number(e.target.value) : null } : x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                          <option value="">Almacén (opcional)</option>
                          {almacenes.map(a => <option key={a.idAlmacen} value={a.idAlmacen}>{a.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={1} value={ln.cantidad}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, cantidad: parseInt(e.target.value) || 1 } : x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none" placeholder="Cant." />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} step={0.01} value={ln.precioUnitario}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, precioUnitario: parseFloat(e.target.value) || 0 } : x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none" placeholder="Precio" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeLinea(i)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {lineas.length > 0 && (
                  <div className="flex justify-end mt-2 text-sm font-bold">
                    Total: {fmt(totalLineas)}
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowNueva(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-crear-orden" onClick={handleCrear} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago */}
      {pagoOrdenId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Registrar Pago</h3>
              <button onClick={() => setPagoOrdenId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Monto <span className="text-rose-500">*</span></label>
                <input id="input-pago-monto" type="number" step={0.01} min={0.01} value={pagoMonto}
                  onChange={e => setPagoMonto(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Método</label>
                <select id="input-pago-metodo" value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Referencia</label>
                <input id="input-pago-referencia" type="text" value={pagoRef} onChange={e => setPagoRef(e.target.value)}
                  placeholder="Número de transacción (opcional)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              {pagoError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{pagoError}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setPagoOrdenId(null)} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-confirmar-pago" onClick={handlePago} disabled={savingPago}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-60">
                {savingPago && <Loader2 size={14} className="animate-spin" />}
                {savingPago ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${confirmAction.accion === 'anular' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
                {confirmAction.accion === 'anular'
                  ? <Ban size={20} className="text-rose-500" />
                  : <CheckCircle2 size={20} className="text-amber-600" />}
              </div>
              <h3 className="text-lg font-bold">
                {confirmAction.accion === 'anular' ? '¿Anular orden?' : '¿Forzar cierre?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction.accion === 'anular'
                ? 'La orden pasará a estado ANULADA. Esta acción no se puede deshacer.'
                : 'La orden se cerrará como COMPLETADA aunque haya mercancía pendiente de recibir.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button id="btn-confirmar-accion"
                onClick={() => handleEstado(confirmAction.id, confirmAction.accion)}
                className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
                  confirmAction.accion === 'anular' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {confirmAction.accion === 'anular' ? 'Anular' : 'Forzar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
