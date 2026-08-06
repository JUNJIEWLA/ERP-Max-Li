import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  useFloating, autoUpdate, offset, flip, shift,
} from '@floating-ui/react-dom';
import {
  Plus, X, Loader2, PackageCheck, Search, CheckCircle2, XCircle,
  AlertTriangle, MoreVertical, Eye, CreditCard, FileText,
  ClipboardCheck, ClipboardX, Package, Calendar, Hash,
  ChevronLeft, ChevronRight, LayoutGrid, ShieldCheck, Clock, Save, RotateCcw, AlertCircle
} from 'lucide-react';
import {
  notasRecepcionApi, ordenesCompraApi, alertasCostoApi, almacenesApi,
  OrdenCompra, NotaRecepcion, Almacen,
} from '../../imports/api';
import AlertasCostoBuzon from './AlertasCostoBuzon';

// ─── Formateador de moneda ────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

// ─── Badges ───────────────────────────────────────────────
const ESTADO_BADGE: Record<string, { cls: string; label: string }> = {
  PENDIENTE:  { cls: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',  label: 'Pendiente'  },
  CONFIRMADA: { cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20', label: 'Confirmada' },
  RECHAZADA:  { cls: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',   label: 'Rechazada'  },
};

const OBS_BADGE: Record<string, { cls: string; label: string }> = {
  CONFORME:   { cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20', label: 'Conforme'   },
  DAÑADO:     { cls: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',   label: 'Dañado'     },
  INCOMPLETO: { cls: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',  label: 'Incompleto' },
};

type LineaRecepcion = {
  idDetalleOrdenCompra: number;
  nombreProducto: string;
  cantidadPendiente: number;
  cantidadRecibida: number;
  observacion: string;
  notas: string;
  idAlmacen?: number | null;
};

/* ═══════════════════════════════════════════════════════════
   DROPDOWN MENU (Floating UI + Portal)
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

  const { refs, floatingStyles, update } = useFloating({
    open,
    strategy: 'fixed', 
    placement: 'bottom-end',
    middleware: [
      offset(6), 
      flip({ fallbackPlacements: ['top-end'] }),
      shift({ padding: 8 })
    ],
    whileElementsMounted: autoUpdate,
  });

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
      success: 'text-emerald-600 hover:bg-emerald-500/10',
      danger:  'text-rose-600 hover:bg-rose-500/10',
      info:    'text-blue-600 hover:bg-blue-500/10',
      warning: 'text-amber-600 hover:bg-amber-500/10',
    };
    return (
      <button
        onClick={() => { onClick(); setOpen(false); }}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors font-medium ${c[variant]}`}
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
      className="bg-card border border-border rounded-xl shadow-2xl p-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
      onAnimationEnd={update}
    >
      <div className="px-3 py-2 mb-1 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nota de Recepción</p>
        <p className="text-xs font-mono font-bold text-foreground">
          NR-{String(nota.idNotaRecepcion).padStart(4, '0')}
          <span className="ml-2 font-normal text-muted-foreground">← OC-{String(nota.idOrdenCompra).padStart(4, '0')}</span>
        </p>
      </div>

      {mi(<Eye size={14} />,      'Ver detalles',    onVerDetalles)}
      {mi(<FileText size={14} />, 'Generar reporte', onGenerarReporte)}

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

/* ═══════════════════════════════════════════════════════════
   MODAL VER DETALLES
═══════════════════════════════════════════════════════════ */
function DetalleModal({ nota, onClose }: { nota: NotaRecepcion; onClose: () => void }) {
  const estadoInfo = ESTADO_BADGE[nota.estado] ?? { cls: 'bg-muted text-muted-foreground border-border', label: nota.estado };
  const conformes  = nota.detalles.filter(d => d.observacion === 'CONFORME').length;
  const dañados    = nota.detalles.filter(d => d.observacion === 'DAÑADO').length;
  const incompl    = nota.detalles.filter(d => d.observacion === 'INCOMPLETO').length;
  const totalRec   = nota.detalles.reduce((s, d) => s + d.cantidadRecibida, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PackageCheck size={20} className="text-emerald-600" />
              <h3 className="text-lg font-bold">Nota de Recepción</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>NR-{String(nota.idNotaRecepcion).padStart(4, '0')}</span>
              <span className="text-border">·</span>
              <span>OC-{String(nota.idOrdenCompra).padStart(4, '0')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estadoInfo.cls}`}>
              {estadoInfo.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total recibido', value: totalRec, icon: <Package size={14} />, cls: 'text-foreground' },
              { label: 'Conformes',      value: conformes, icon: <CheckCircle2 size={14} />, cls: 'text-emerald-600' },
              { label: 'Dañados',        value: dañados,  icon: <XCircle size={14} />, cls: 'text-rose-600' },
              { label: 'Incompletos',    value: incompl,  icon: <AlertTriangle size={14} />, cls: 'text-amber-600' },
            ].map(({ label, value, icon, cls }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                <div className={`flex justify-center mb-1 ${cls}`}>{icon}</div>
                <p className={`text-xl font-bold ${cls}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3.5 py-2.5 border border-border">
              <Calendar size={15} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Fecha de recepción</p>
                <p className="text-sm font-semibold">{new Date(nota.fechaRecepcion).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3.5 py-2.5 border border-border">
              <Hash size={15} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Orden de compra</p>
                <p className="text-sm font-semibold font-mono">OC-{String(nota.idOrdenCompra).padStart(4, '0')}</p>
              </div>
            </div>
          </div>

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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-md border border-border">
                          Almacén: {d.nombreAlmacen || 'No asignado'}
                        </span>
                        {d.notas && (
                          <span className="text-xs text-muted-foreground italic truncate">"{d.notas}"</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Solicitado / Recibido</p>
                        <p className="text-sm font-bold font-mono">
                          {d.cantidadSolicitada}
                          <span className="text-muted-foreground font-normal"> / </span>
                          {d.cantidadRecibida}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${obs.cls}`}>
                        {obs.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end bg-card">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL REGISTRAR PAGO
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <CreditCard size={18} className="text-blue-600" />
            </div>
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
          <div className="flex items-start gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3.5 py-2.5">
            <CreditCard size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Este pago se aplicará a la <strong>Orden de Compra OC-{String(idOrdenCompra).padStart(4, '0')}</strong> asociada a esta recepción.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Monto <span className="text-rose-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">RD$</span>
              <input
                id="input-pago-monto-nota"
                type="number" step={0.01} min={0.01} value={monto}
                onChange={e => setMonto(e.target.value)} placeholder="0.00"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Método de pago</label>
            <select
              id="input-pago-metodo-nota"
              value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="TRANSFERENCIA">Transferencia bancaria</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Referencia <span className="text-muted-foreground text-xs">(opcional)</span></label>
            <input
              id="input-pago-referencia-nota"
              type="text" value={ref} onChange={e => setRef(e.target.value)}
              placeholder="Número de transacción"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/8 border border-rose-500/20 px-3.5 py-2.5 rounded-xl">
              <AlertCircle size={15} className="flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium">
            Cancelar
          </button>
          <button
            id="btn-confirmar-pago-nota"
            onClick={handlePago} disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold disabled:opacity-60 shadow-sm shadow-blue-600/30"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
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
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 15;

  const [detalleNota,  setDetalleNota]  = useState<NotaRecepcion | null>(null);
  const [pagoNota,     setPagoNota]     = useState<NotaRecepcion | null>(null);
  const [confirmNota,  setConfirmNota]  = useState<{ id: number; accion: 'confirmar' | 'rechazar' } | null>(null);
  const [reporteToast, setReporteToast] = useState<string | null>(null);

  const [showBuzonAlertas, setShowBuzonAlertas] = useState(false);

  const [showModal,      setShowModal]     = useState(false);
  const [ordenes,        setOrdenes]       = useState<OrdenCompra[]>([]);
  const [almacenes,      setAlmacenes]     = useState<Almacen[]>([]);
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
      setTotalElements(data.totalElements || data.content.length);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const openModal = async () => {
    setIdOrdenSel(''); setOrdenDetalle(null); setLineas([]); setFormError('');
    try {
      const [res, almRes] = await Promise.all([
        ordenesCompraApi.listar(0, 100),
        almacenesApi.listar(0, 100),
      ]);
      const aptas = res.content.filter(o =>
        o.estado === 'ENVIADA' || o.estado === 'RECEPCION_PARCIAL'
      );
      setOrdenes(aptas);
      setAlmacenes(almRes.content.filter(a => a.estado === 'ACTIVO'));
    } catch { setFormError('Error cargando datos'); }
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
          idAlmacen: d.idAlmacen ?? null,
        }))
      );
    } catch { setFormError('Error cargando orden'); }
    finally { setLoadingOrden(false); }
  };

  const handleCrear = async () => {
    if (!idOrdenSel)          { setFormError('Selecciona una orden'); return; }
    if (lineas.length === 0)  { setFormError('No hay ítems pendientes de recibir'); return; }
    if (lineas.some(l => l.cantidadRecibida < 1)) { setFormError('La cantidad recibida debe ser al menos 1'); return; }
    if (lineas.some(l => !l.idAlmacen)) { setFormError('Selecciona un almacén de destino para cada producto'); return; }
    setSaving(true); setFormError('');
    try {
      await notasRecepcionApi.crear({
        idOrdenCompra: Number(idOrdenSel),
        detalles: lineas.map(l => ({
          idDetalleOrdenCompra: l.idDetalleOrdenCompra,
          cantidadRecibida: l.cantidadRecibida,
          observacion: l.observacion,
          notas: l.notas || undefined,
          idAlmacen: Number(l.idAlmacen),
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
      if (confirmNota.accion === 'confirmar') {
        await notasRecepcionApi.confirmar(confirmNota.id);
        const { count } = await alertasCostoApi.contarPendientes();
        if (count > 0) {
          setShowBuzonAlertas(true);
        } else {
          setReporteToast('Recepción confirmada exitosamente');
          setTimeout(() => setReporteToast(null), 3000);
        }
      }
      else {
        await notasRecepcionApi.rechazar(confirmNota.id);
      }
      fetchNotas();
    } catch (e: any) {
      alert(e.message || 'Error en la acción');
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

  const confirmadasCount = notas.filter(n => n.estado === 'CONFIRMADA').length;
  const pendientesCount = notas.filter(n => n.estado === 'PENDIENTE').length;

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Toast reporte */}
      {reporteToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <Loader2 size={16} className="animate-spin text-primary" />
          {reporteToast}
        </div>
      )}

      {/* Buzón Alertas Costo Modal (Desencadenado al confirmar recepción si existen variaciones) */}
      {showBuzonAlertas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                  <AlertTriangle size={22} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Variación de Costos Detectada</h3>
                  <p className="text-xs text-muted-foreground">La recepción incluyó artículos con cambio de costo. Revisa las sugerencias de precios.</p>
                </div>
              </div>
              <button onClick={() => setShowBuzonAlertas(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <AlertasCostoBuzon />
            </div>
            <div className="p-4 border-t border-border flex justify-end bg-card">
              <button onClick={() => setShowBuzonAlertas(false)} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                Entendido / Cerrar Buzón
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <PackageCheck size={22} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Notas de Recepción</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Control de entrada de inventario y recepción física de mercancía</p>
            </div>
          </div>
          <button
            id="btn-nueva-nota"
            onClick={openModal}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-semibold text-sm shadow-sm shadow-emerald-600/30 hover:shadow-md hover:shadow-emerald-600/20 hover:-translate-y-px"
          >
            <Plus size={16} /> Nueva Recepción
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><LayoutGrid size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total recepciones</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><ShieldCheck size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{confirmadasCount}</p>
              <p className="text-xs text-muted-foreground">Confirmadas en inventario</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-lg"><Clock size={18} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendientesCount}</p>
              <p className="text-xs text-muted-foreground">Pendientes de confirmación</p>
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
                placeholder="Buscar por #nota u #orden..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
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
                <Loader2 size={32} className="animate-spin text-emerald-600" />
                <p className="text-sm text-muted-foreground">Cargando notas de recepción...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><PackageCheck size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron notas de recepción</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"># Nota</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"># Orden</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Productos Recibidos</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen Físico</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(n => {
                    const estadoInfo = ESTADO_BADGE[n.estado] ?? { cls: 'bg-muted text-muted-foreground border-border', label: n.estado };
                    const conformes = n.detalles.filter(d => d.observacion === 'CONFORME').length;
                    const dañados   = n.detalles.filter(d => d.observacion === 'DAÑADO').length;
                    const incompl   = n.detalles.filter(d => d.observacion === 'INCOMPLETO').length;

                    return (
                      <tr key={n.idNotaRecepcion} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            NR-{String(n.idNotaRecepcion).padStart(4, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                          OC-{String(n.idOrdenCompra).padStart(4, '0')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${estadoInfo.cls}`}>
                            {estadoInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {n.detalles.map(d => {
                              const obs = OBS_BADGE[d.observacion] ?? { cls: 'bg-muted text-muted-foreground', label: d.observacion };
                              return (
                                <span key={d.idDetalleNotaRecepcion}
                                  className={`text-xs px-2 py-0.5 rounded-lg font-medium ${obs.cls}`}
                                  title={d.nombreAlmacen ? `Almacén: ${d.nombreAlmacen}` : undefined}>
                                  {d.nombreProducto} ({d.nombreAlmacen || 'Sin Almacén'}) ×{d.cantidadRecibida}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            {conformes > 0 && (
                              <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                <CheckCircle2 size={12} />{conformes}
                              </span>
                            )}
                            {dañados > 0 && (
                              <span className="flex items-center gap-1 text-rose-600 font-medium bg-rose-500/10 px-2 py-0.5 rounded-md">
                                <XCircle size={12} />{dañados}
                              </span>
                            )}
                            {incompl > 0 && (
                              <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md">
                                <AlertTriangle size={12} />{incompl}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono whitespace-nowrap">
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
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/50 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong> — {totalElements} registros</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-emerald-600 text-white' : 'hover:bg-muted border border-border'}`}>{pg + 1}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Ver Detalles */}
      {detalleNota && <DetalleModal nota={detalleNota} onClose={() => setDetalleNota(null)} />}

      {/* Modal Registrar Pago */}
      {pagoNota && (
        <PagoModal
          idOrdenCompra={pagoNota.idOrdenCompra}
          idNotaRecepcion={pagoNota.idNotaRecepcion}
          onClose={() => setPagoNota(null)}
          onSuccess={fetchNotas}
        />
      )}

      {/* Modal Nueva Nota */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <PackageCheck size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Nueva Nota de Recepción</h3>
                <p className="text-xs text-muted-foreground">Registra la entrada física de mercancía desde una orden enviada</p>
              </div>
              <button onClick={() => setShowModal(false)} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Orden de Compra <span className="text-rose-500">*</span></label>
                <select id="sel-orden-nota" value={idOrdenSel} onChange={e => onOrdenChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  <option value="">Seleccionar orden pendiente...</option>
                  {ordenes.map(o => (
                    <option key={o.idOrdenCompra} value={o.idOrdenCompra}>
                      OC-{String(o.idOrdenCompra).padStart(4, '0')} — {o.nombreProveedor} ({o.estado.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {loadingOrden && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-emerald-600" /></div>}

              {lineas.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3">Productos pendientes de recibir</p>
                  <div className="space-y-3">
                    {lineas.map((ln, i) => (
                      <div key={ln.idDetalleOrdenCompra} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">{ln.nombreProducto}</span>
                          <span className="text-xs bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                            Pendiente: <strong>{ln.cantidadPendiente}</strong>
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cant. recibida</label>
                            <input type="number" min={1} max={ln.cantidadPendiente} value={ln.cantidadRecibida}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i
                                ? { ...x, cantidadRecibida: Math.min(ln.cantidadPendiente, parseInt(e.target.value) || 1) } : x))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Almacén Destino <span className="text-rose-500">*</span></label>
                            <select value={ln.idAlmacen || ''}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, idAlmacen: e.target.value ? Number(e.target.value) : null } : x))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40">
                              <option value="">Seleccionar...</option>
                              {almacenes.map(a => <option key={a.idAlmacen} value={a.idAlmacen}>{a.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Estado físico</label>
                            <select value={ln.observacion}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, observacion: e.target.value } : x))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40">
                              <option value="CONFORME">✅ Conforme</option>
                              <option value="DAÑADO">❌ Dañado</option>
                              <option value="INCOMPLETO">⚠️ Incompleto</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notas</label>
                            <input type="text" value={ln.notas}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, notas: e.target.value } : x))}
                              placeholder="Observación"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/8 border border-rose-500/20 px-3.5 py-2.5 rounded-xl">
                  <AlertCircle size={15} className="flex-shrink-0" /> {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-6 border-t border-border pt-4">
              <button onClick={() => setShowModal(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">
                <RotateCcw size={14} /> Cancelar
              </button>
              <button id="btn-crear-nota" onClick={handleCrear} disabled={saving || lineas.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-sm font-semibold disabled:opacity-60 shadow-sm shadow-emerald-600/30">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Registrando...' : 'Registrar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar / Rechazar */}
      {confirmNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${confirmNota.accion === 'confirmar' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                {confirmNota.accion === 'confirmar'
                  ? <CheckCircle2 size={22} className="text-emerald-600" />
                  : <AlertTriangle size={22} className="text-rose-500" />}
              </div>
              <div>
                <h3 className="font-bold text-foreground">
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
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button id="btn-confirmar-accion-nota" onClick={handleAccion}
                className={`px-4 py-2.5 rounded-xl text-white transition-colors text-sm font-semibold shadow-sm ${
                  confirmNota.accion === 'confirmar' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-rose-500 hover:bg-rose-600'}`}>
                {confirmNota.accion === 'confirmar' ? 'Sí, Confirmar' : 'Sí, Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}