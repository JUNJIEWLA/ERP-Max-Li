import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  useFloating, autoUpdate, offset, shift, // flip eliminado
} from '@floating-ui/react-dom';
import {
  Plus, X, Loader2, PackageCheck, Search, CheckCircle2, XCircle,
  AlertTriangle, MoreVertical, Eye, CreditCard, FileText,
  ClipboardCheck, ClipboardX, Package, Calendar, Hash,
} from 'lucide-react';
import {
  notasRecepcionApi, ordenesCompraApi,
  OrdenCompra, NotaRecepcion,
} from '../../imports/api';

// ─── Formateador de moneda ────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

// ─── Badges ───────────────────────────────────────────────
const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  PENDIENTE:  { cls: 'bg-amber-500/15 text-amber-700 ring-amber-400/30',  label: 'Pendiente'  },
  CONFIRMADA: { cls: 'bg-green-500/15 text-green-600 ring-green-400/30',  label: 'Confirmada' },
  RECHAZADA:  { cls: 'bg-rose-500/15  text-rose-600  ring-rose-400/30',   label: 'Rechazada'  },
};

const OBS_BADGE: Record<string, { cls: string; label: string }> = {
  CONFORME:   { cls: 'bg-green-500/15 text-green-600',  label: 'Conforme'   },
  DAÑADO:     { cls: 'bg-rose-500/15  text-rose-600',   label: 'Dañado'     },
  INCOMPLETO: { cls: 'bg-amber-500/15 text-amber-700',  label: 'Incompleto' },
};

type LineaRecepcion = {
  idDetalleOrdenCompra: number;
  nombreProducto: string;
  cantidadPendiente: number;
  cantidadRecibida: number;
  observacion: string;
  notas: string;
};

/* ═══════════════════════════════════════════════════════════
   DROPDOWN MENU  (Floating UI + Portal, forzado hacia abajo)
═══════════════════════════════════════════════════════════ */
interface RowMenuProps {
  nota: NotaRecepcion;
  onVerDetalles: () => void;
  onConfirmar: () => void;
  onRechazar: () => void;
  onRegistrarPago: () => void;
  onGenerarReporte: () => void;
}

function RowMenu({ nota, onVerDetalles, onConfirmar, onRechazar, onRegistrarPago, onGenerarReporte }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  // useFloating con strategy 'fixed' y SIN 'flip' para forzar apertura hacia abajo
  const { refs, floatingStyles, update } = useFloating({
    open,
    strategy: 'fixed', 
    placement: 'bottom-end', // Forzado siempre hacia abajo
    middleware: [
      offset(6), 
      shift({ padding: 8 }) // flip() fue removido de aquí
    ],
    whileElementsMounted: autoUpdate,
  });

  // Cerrar al hacer clic fuera o Escape
  useEffect(() => {
    if (!open) return;
    const onPD = (e: PointerEvent) => {
      const f = refs.floating.current;
      const r = refs.reference.current as Element | null;
      if (f && !f.contains(e.target as Node) && r && !r.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPD);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPD);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, refs]);

  const isPendiente  = nota.estado === 'PENDIENTE';
  const isConfirmada = nota.estado === 'CONFIRMADA';

  const mi = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    variant: 'default' | 'success' | 'danger' | 'info' | 'warning' = 'default'
  ) => {
    const c: Record<string, string> = {
      default: 'text-foreground hover:bg-muted',
      success: 'text-green-600 hover:bg-green-500/10',
      danger:  'text-rose-600 hover:bg-rose-500/10',
      info:    'text-blue-600 hover:bg-blue-500/10',
      warning: 'text-amber-600 hover:bg-amber-500/10',
    };
    return (
      <button
        onClick={() => { onClick(); setOpen(false); }}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors ${c[variant]}`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {label}
      </button>
    );
  };

  const dropdown = open && createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex: 9999, width: 232 }}
      className="bg-card border border-border rounded-xl shadow-2xl p-1.5 ring-1 ring-black/5"
      onAnimationEnd={update}
    >
      {/* Cabecera */}
      <div className="px-3 py-2 mb-1 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nota de Recepción</p>
        <p className="text-xs font-mono font-bold text-foreground">
          NR-{String(nota.idNotaRecepcion).padStart(4, '0')}
          <span className="ml-2 font-normal text-muted-foreground">← OC-{String(nota.idOrdenCompra).padStart(4, '0')}</span>
        </p>
      </div>

      {/* Acciones permanentes */}
      {mi(<Eye size={14} />,      'Ver detalles',    onVerDetalles)}
      {mi(<FileText size={14} />, 'Generar reporte', onGenerarReporte)}

      {/* Acciones contextuales */}
      {(isPendiente || isConfirmada) && <div className="my-1.5 border-t border-border" />}
      {(isPendiente || isConfirmada) && (
        <p className="px-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones</p>
      )}
      {isPendiente  && mi(<ClipboardCheck size={14} />, 'Confirmar recepción', onConfirmar,       'success')}
      {isPendiente  && mi(<ClipboardX size={14} />,    'Rechazar recepción',  onRechazar,        'danger')}
      {isConfirmada && mi(<CreditCard size={14} />,    'Registrar pago',      onRegistrarPago,   'info')}
    </div>,
    document.body
  );

  return (
    <div className="flex justify-center">
      <button
        ref={refs.setReference}
        id={`btn-menu-nota-${nota.idNotaRecepcion}`}
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

/* ═══════════════════════════════════════════════════════════
   MODAL VER DETALLES
═══════════════════════════════════════════════════════════ */
function DetalleModal({ nota, onClose }: { nota: NotaRecepcion; onClose: () => void }) {
  const estadoInfo = ESTADO_BADGE[nota.estado] ?? { cls: 'bg-muted text-muted-foreground ring-border', label: nota.estado };
  const conformes  = nota.detalles.filter(d => d.observacion === 'CONFORME').length;
  const dañados    = nota.detalles.filter(d => d.observacion === 'DAÑADO').length;
  const incompl    = nota.detalles.filter(d => d.observacion === 'INCOMPLETO').length;
  const totalRec   = nota.detalles.reduce((s, d) => s + d.cantidadRecibida, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PackageCheck size={18} className="text-primary" />
              <h3 className="text-lg font-bold">Nota de Recepción</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>NR-{String(nota.idNotaRecepcion).padStart(4, '0')}</span>
              <span className="text-border">·</span>
              <span>OC-{String(nota.idOrdenCompra).padStart(4, '0')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${estadoInfo.cls}`}>
              {estadoInfo.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total recibido', value: totalRec, icon: <Package size={14} />, cls: 'text-foreground' },
              { label: 'Conformes',      value: conformes, icon: <CheckCircle2 size={14} />, cls: 'text-green-600' },
              { label: 'Dañados',        value: dañados,  icon: <XCircle size={14} />, cls: 'text-rose-600' },
              { label: 'Incompletos',    value: incompl,  icon: <AlertTriangle size={14} />, cls: 'text-amber-600' },
            ].map(({ label, value, icon, cls }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
                <div className={`flex justify-center mb-1 ${cls}`}>{icon}</div>
                <p className={`text-xl font-bold ${cls}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Info general */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5">
              <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Fecha de recepción</p>
                <p className="text-sm font-semibold">{new Date(nota.fechaRecepcion).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5">
              <Hash size={14} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Orden de compra</p>
                <p className="text-sm font-semibold font-mono">OC-{String(nota.idOrdenCompra).padStart(4, '0')}</p>
              </div>
            </div>
          </div>

          {/* Detalles de productos */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Productos recibidos
            </p>
            <div className="space-y-2">
              {nota.detalles.map(d => {
                const obs = OBS_BADGE[d.observacion] ?? { cls: 'bg-muted text-muted-foreground', label: d.observacion };
                return (
                  <div key={d.idDetalleNotaRecepcion}
                    className="flex items-center justify-between bg-muted/30 border border-border rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.nombreProducto}</p>
                      {d.notas && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{d.notas}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Solicitado / Recibido</p>
                        <p className="text-sm font-bold">
                          {d.cantidadSolicitada}
                          <span className="text-muted-foreground font-normal"> / </span>
                          {d.cantidadRecibida}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${obs.cls}`}>
                        {obs.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL REGISTRAR PAGO  (sobre la OC asociada)
═══════════════════════════════════════════════════════════ */
interface PagoModalProps {
  idOrdenCompra: number;
  idNotaRecepcion: number;
  onClose: () => void;
  onSuccess: () => void;
}
function PagoModal({ idOrdenCompra, idNotaRecepcion, onClose, onSuccess }: PagoModalProps) {
  const [monto,  setMonto]  = useState('');
  const [metodo, setMetodo] = useState('TRANSFERENCIA');
  const [ref,    setRef]    = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handlePago = async () => {
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) { setError('Ingresa un monto válido'); return; }
    setSaving(true); setError('');
    try {
      await ordenesCompraApi.registrarPago(idOrdenCompra, {
        montoPagado: m,
        metodo,
        numeroReferencia: ref || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) { setError(err.message || 'Error al registrar el pago'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <div>
              <h3 className="text-base font-bold">Registrar Pago</h3>
              <p className="text-xs text-muted-foreground font-mono">
                NR-{String(idNotaRecepcion).padStart(4, '0')} → OC-{String(idOrdenCompra).padStart(4, '0')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Aviso de contexto */}
          <div className="flex items-start gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
            <CreditCard size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Este pago se aplicará a la <strong>Orden de Compra OC-{String(idOrdenCompra).padStart(4, '0')}</strong> asociada a esta recepción.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Monto <span className="text-rose-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">RD$</span>
              <input
                id="input-pago-monto-nota"
                type="number" step={0.01} min={0.01} value={monto}
                onChange={e => setMonto(e.target.value)} placeholder="0.00"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Método de pago</label>
            <select
              id="input-pago-metodo-nota"
              value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="TRANSFERENCIA">Transferencia bancaria</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Referencia <span className="text-muted-foreground text-xs">(opcional)</span></label>
            <input
              id="input-pago-referencia-nota"
              type="text" value={ref} onChange={e => setRef(e.target.value)}
              placeholder="Número de transacción"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-xl">
              <AlertTriangle size={14} className="flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-sm">
            Cancelar
          </button>
          <button
            id="btn-confirmar-pago-nota"
            onClick={handlePago} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Procesando...' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function NotasRecepcion() {
  const [notas, setNotas]       = useState<NotaRecepcion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 15;

  // Modals
  const [detalleNota,  setDetalleNota]  = useState<NotaRecepcion | null>(null);
  const [pagoNota,     setPagoNota]     = useState<NotaRecepcion | null>(null);
  const [confirmNota,  setConfirmNota]  = useState<{ id: number; accion: 'confirmar' | 'rechazar' } | null>(null);
  const [reporteToast, setReporteToast] = useState<string | null>(null);

  // Modal nueva nota
  const [showModal,      setShowModal]     = useState(false);
  const [ordenes,        setOrdenes]       = useState<OrdenCompra[]>([]);
  const [idOrdenSel,     setIdOrdenSel]    = useState('');
  const [ordenDetalle,   setOrdenDetalle]  = useState<OrdenCompra | null>(null);
  const [lineas,         setLineas]        = useState<LineaRecepcion[]>([]);
  const [saving,         setSaving]        = useState(false);
  const [formError,      setFormError]     = useState('');
  const [loadingOrden,   setLoadingOrden]  = useState(false);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notasRecepcionApi.listar(page, PAGE_SIZE);
      setNotas(data.content);
      setTotalPages(data.totalPages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const openModal = async () => {
    setIdOrdenSel(''); setOrdenDetalle(null); setLineas([]); setFormError('');
    try {
      const res = await ordenesCompraApi.listar(0, 100);
      const aptas = res.content.filter(o =>
        o.estado === 'ENVIADA' || o.estado === 'RECEPCION_PARCIAL'
      );
      setOrdenes(aptas);
    } catch { setFormError('Error cargando órdenes'); }
    setShowModal(true);
  };

  const onOrdenChange = async (id: string) => {
    setIdOrdenSel(id);
    if (!id) { setOrdenDetalle(null); setLineas([]); return; }
    setLoadingOrden(true);
    try {
      const orden = await ordenesCompraApi.buscarPorId(Number(id));
      setOrdenDetalle(orden);
      setLineas(orden.detalles
        .filter(d => d.cantidadPendiente > 0)
        .map(d => ({
          idDetalleOrdenCompra: d.idDetalleOrdenCompra,
          nombreProducto: d.nombreProducto,
          cantidadPendiente: d.cantidadPendiente,
          cantidadRecibida: d.cantidadPendiente,
          observacion: 'CONFORME',
          notas: '',
        }))
      );
    } catch { setFormError('Error cargando orden'); }
    finally { setLoadingOrden(false); }
  };

  const handleCrear = async () => {
    if (!idOrdenSel)          { setFormError('Selecciona una orden'); return; }
    if (lineas.length === 0)  { setFormError('No hay ítems pendientes de recibir'); return; }
    if (lineas.some(l => l.cantidadRecibida < 1)) { setFormError('La cantidad recibida debe ser al menos 1'); return; }
    setSaving(true); setFormError('');
    try {
      await notasRecepcionApi.crear({
        idOrdenCompra: Number(idOrdenSel),
        detalles: lineas.map(l => ({
          idDetalleOrdenCompra: l.idDetalleOrdenCompra,
          cantidadRecibida: l.cantidadRecibida,
          observacion: l.observacion,
          notas: l.notas || undefined,
        })),
      });
      setShowModal(false);
      fetchNotas();
    } catch (err: any) { setFormError(err.message || 'Error al crear'); }
    finally { setSaving(false); }
  };

  const handleAccion = async () => {
    if (!confirmNota) return;
    try {
      if (confirmNota.accion === 'confirmar') await notasRecepcionApi.confirmar(confirmNota.id);
      else await notasRecepcionApi.rechazar(confirmNota.id);
      fetchNotas();
    } finally { setConfirmNota(null); }
  };

  const handleGenerarReporte = (n: NotaRecepcion) => {
    setReporteToast(`Generando reporte NR-${String(n.idNotaRecepcion).padStart(4, '0')}...`);
    setTimeout(() => setReporteToast(null), 3000);
  };

  const filtered = notas.filter(n =>
    String(n.idOrdenCompra).includes(search) ||
    String(n.idNotaRecepcion).includes(search)
  );

  /* ── RENDER ─────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-6">

      {/* Toast reporte */}
      {reporteToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 text-sm font-medium">
          <Loader2 size={16} className="animate-spin text-primary" />
          {reporteToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PackageCheck size={26} className="text-primary" /> Notas de Recepción
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Registro y control de mercancía recibida de proveedores</p>
        </div>
        <button id="btn-nueva-nota" onClick={openModal}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-sm">
          <Plus size={18} /> Nueva Recepción
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por #nota u #orden..."
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
            <PackageCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay notas de recepción</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground"># Nota</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground"># Orden</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Productos</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Resumen</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-16">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(n => {
                const estadoInfo = ESTADO_BADGE[n.estado] ?? { cls: 'bg-muted text-muted-foreground ring-border', label: n.estado };
                const conformes = n.detalles.filter(d => d.observacion === 'CONFORME').length;
                const dañados   = n.detalles.filter(d => d.observacion === 'DAÑADO').length;
                const incompl   = n.detalles.filter(d => d.observacion === 'INCOMPLETO').length;

                return (
                  <tr key={n.idNotaRecepcion} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      NR-{String(n.idNotaRecepcion).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      OC-{String(n.idOrdenCompra).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ${estadoInfo.cls}`}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {n.detalles.map(d => {
                          const obs = OBS_BADGE[d.observacion] ?? { cls: 'bg-muted text-muted-foreground', label: d.observacion };
                          return (
                            <span key={d.idDetalleNotaRecepcion}
                              className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${obs.cls}`}>
                              {d.nombreProducto} ×{d.cantidadRecibida}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        {conformes > 0 && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 size={12} />{conformes}
                          </span>
                        )}
                        {dañados > 0 && (
                          <span className="flex items-center gap-1 text-rose-600 font-medium">
                            <XCircle size={12} />{dañados}
                          </span>
                        )}
                        {incompl > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <AlertTriangle size={12} />{incompl}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(n.fechaRecepcion).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <RowMenu
                        nota={n}
                        onVerDetalles={() => setDetalleNota(n)}
                        onConfirmar={() => setConfirmNota({ id: n.idNotaRecepcion, accion: 'confirmar' })}
                        onRechazar={() => setConfirmNota({ id: n.idNotaRecepcion, accion: 'rechazar' })}
                        onRegistrarPago={() => setPagoNota(n)}
                        onGenerarReporte={() => handleGenerarReporte(n)}
                      />
                    </td>
                  </tr>
                );
              })}
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

      {/* ── Modal Ver Detalles ── */}
      {detalleNota && <DetalleModal nota={detalleNota} onClose={() => setDetalleNota(null)} />}

      {/* ── Modal Registrar Pago ── */}
      {pagoNota && (
        <PagoModal
          idOrdenCompra={pagoNota.idOrdenCompra}
          idNotaRecepcion={pagoNota.idNotaRecepcion}
          onClose={() => setPagoNota(null)}
          onSuccess={fetchNotas}
        />
      )}

      {/* ── Modal Nueva Nota ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold">Nueva Nota de Recepción</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Registra la mercancía recibida del proveedor</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium mb-1.5">Orden de Compra <span className="text-rose-500">*</span></label>
                <select id="sel-orden-nota" value={idOrdenSel} onChange={e => onOrdenChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Seleccionar orden pendiente...</option>
                  {ordenes.map(o => (
                    <option key={o.idOrdenCompra} value={o.idOrdenCompra}>
                      OC-{String(o.idOrdenCompra).padStart(4, '0')} — {o.nombreProveedor} ({o.estado.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {loadingOrden && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-primary" /></div>}

              {lineas.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3">Productos pendientes de recibir</p>
                  <div className="space-y-2.5">
                    {lineas.map((ln, i) => (
                      <div key={ln.idDetalleOrdenCompra} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{ln.nombreProducto}</span>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            Pendiente: <strong>{ln.cantidadPendiente}</strong>
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cantidad recibida</label>
                            <input type="number" min={1} max={ln.cantidadPendiente} value={ln.cantidadRecibida}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i
                                ? { ...x, cantidadRecibida: Math.min(ln.cantidadPendiente, parseInt(e.target.value) || 1) } : x))}
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Estado físico</label>
                            <select value={ln.observacion}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, observacion: e.target.value } : x))}
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
                              <option value="CONFORME">✅ Conforme</option>
                              <option value="DAÑADO">❌ Dañado</option>
                              <option value="INCOMPLETO">⚠️ Incompleto</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
                            <input type="text" value={ln.notas}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, notas: e.target.value } : x))}
                              placeholder="Observación opcional"
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-xl">
                  <AlertTriangle size={14} className="flex-shrink-0" />{formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-crear-nota" onClick={handleCrear} disabled={saving || lineas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Registrando...' : 'Registrar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar / Rechazar ── */}
      {confirmNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${confirmNota.accion === 'confirmar' ? 'bg-green-500/10' : 'bg-rose-500/10'}`}>
                {confirmNota.accion === 'confirmar'
                  ? <CheckCircle2 size={20} className="text-green-600" />
                  : <AlertTriangle size={20} className="text-rose-500" />}
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {confirmNota.accion === 'confirmar' ? '¿Confirmar recepción?' : '¿Rechazar recepción?'}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  NR-{String(confirmNota.id).padStart(4, '0')}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmNota.accion === 'confirmar'
                ? 'Se actualizará el inventario con las cantidades CONFORMES recibidas. Esta acción no se puede deshacer.'
                : 'La nota quedará RECHAZADA y no se actualizará el inventario. Esta acción no se puede deshacer.'}
            </p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setConfirmNota(null)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button id="btn-confirmar-accion-nota" onClick={handleAccion}
                className={`px-4 py-2 rounded-xl text-white transition-colors text-sm font-medium ${
                  confirmNota.accion === 'confirmar' ? 'bg-green-600 hover:bg-green-700' : 'bg-rose-500 hover:bg-rose-600'}`}>
                {confirmNota.accion === 'confirmar' ? 'Confirmar' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}