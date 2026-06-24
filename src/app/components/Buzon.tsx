import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Check, X, Loader2, TrendingUp, TrendingDown, Package, AlertTriangle, Clock, ShoppingCart
} from 'lucide-react';
import { alertasCostoApi, alertasRetrasoOcApi, type AlertaCosto, type AlertaRetrasoOc } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface BuzonProps {
  onClose?: () => void;
  onUpdateCount?: () => void;
}

type Tab = 'costos' | 'retrasos';

/* ─── Tab: Alertas de Costo ─────────────────────────────────────────── */
function TabCostos({ onUpdateCount }: { onUpdateCount?: () => void }) {
  const [alertas, setAlertas] = useState<AlertaCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertasCostoApi.listarPendientes(0, 100);
      setAlertas(res.content);
      if (onUpdateCount) onUpdateCount();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [onUpdateCount]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === alertas.length ? new Set() : new Set(alertas.map(a => a.idAlertaCosto)));

  const handleAction = async (action: 'aplicar' | 'descartar') => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      if (action === 'aplicar') await alertasCostoApi.aplicarMasivo(ids);
      else await alertasCostoApi.descartarMasivo(ids);
      setSelectedIds(new Set());
      cargar();
    } catch { alert('Error al procesar las alertas'); }
    finally { setProcessing(false); }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium text-lg">No hay alertas pendientes</p>
            <p className="text-sm mt-1 opacity-70">Todos los precios están actualizados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alertas.map(a => (
              <div key={a.idAlertaCosto} className="flex gap-4 p-4 border border-border rounded-xl hover:border-primary/30 transition-colors bg-background">
                <div className="pt-1">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedIds.has(a.idAlertaCosto)}
                    onChange={() => toggleSelect(a.idAlertaCosto)} />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <Package size={16} className="text-muted-foreground" /> {a.nombreProducto}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Generada el {new Date(a.fechaCreacion).toLocaleDateString()}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${a.porcentajeVariacion > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                      {a.porcentajeVariacion > 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                      {a.porcentajeVariacion > 0 ? '+' : ''}{a.porcentajeVariacion}% Costo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Costo Anterior → Nuevo</p>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className="text-muted-foreground line-through">{fmt(a.costoAnterior)}</span>
                        <span className="font-bold text-foreground">{fmt(a.costoNuevo)}</span>
                      </div>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                      <p className="text-[10px] uppercase font-semibold text-primary mb-1">Precio Venta (Margen: {a.porcentajeMargen}%)</p>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className="text-muted-foreground">Actual: {fmt(a.precioVentaActual)}</span>
                        <span className="text-primary font-bold">Sug: {fmt(a.precioVentaSugerido)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="p-5 border-t border-border bg-muted/10 shrink-0 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={selectedIds.size === alertas.length && alertas.length > 0}
              onChange={toggleAll} />
            Seleccionar Todo ({selectedIds.size})
          </label>
          <div className="flex gap-3">
            <button onClick={() => handleAction('descartar')} disabled={selectedIds.size === 0 || processing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-200 transition-colors text-sm font-medium disabled:opacity-50">
              <X size={16} /> Descartar
            </button>
            <button onClick={() => handleAction('aplicar')} disabled={selectedIds.size === 0 || processing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 shadow-sm">
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Aplicar Precios Sugeridos
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Tab: Retrasos de OC ────────────────────────────────────────────── */
function TabRetrasos({ onUpdateCount }: { onUpdateCount?: () => void }) {
  const [alertas, setAlertas] = useState<AlertaRetrasoOc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertasRetrasoOcApi.listarPendientes(0, 100);
      setAlertas(res.content);
      if (onUpdateCount) onUpdateCount();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [onUpdateCount]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === alertas.length ? new Set() : new Set(alertas.map(a => a.idAlertaRetraso)));

  const handleMarcarLeidas = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      await alertasRetrasoOcApi.marcarLeidasMasivo(Array.from(selectedIds));
      setSelectedIds(new Set());
      cargar();
    } catch { alert('Error al marcar como leídas'); }
    finally { setProcessing(false); }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium text-lg">No hay retrasos pendientes</p>
            <p className="text-sm mt-1 opacity-70">Todas las órdenes están dentro del plazo acordado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.map(a => {
              const pulse = a.diasRetraso <= 3;
              return (
                <div key={a.idAlertaRetraso} className="flex gap-4 p-4 border border-rose-200/60 rounded-xl hover:border-rose-400/40 transition-colors bg-background">
                  <div className="pt-1">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedIds.has(a.idAlertaRetraso)}
                      onChange={() => toggleSelect(a.idAlertaRetraso)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground flex items-center gap-2">
                          <ShoppingCart size={15} className="text-muted-foreground" />
                          OC-{String(a.idOrdenCompra).padStart(4, '0')}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{a.nombreProveedor}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 ${pulse ? 'animate-pulse' : ''}`}>
                        <AlertTriangle size={12} />
                        {a.diasRetraso === 0 ? 'Vence hoy' : `${a.diasRetraso} días de retraso`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-lg p-2.5 border border-rose-100 dark:border-rose-900/30">
                        <p className="text-[10px] uppercase font-semibold text-rose-500 mb-0.5">Fecha acordada</p>
                        <p className="text-sm font-mono font-bold text-rose-700">{fmtDate(a.fechaLlegadaAcordada)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Alerta generada</p>
                        <p className="text-sm text-foreground">{new Date(a.fechaCreacion).toLocaleDateString('es-DO')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="p-5 border-t border-border bg-muted/10 shrink-0 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={selectedIds.size === alertas.length && alertas.length > 0}
              onChange={toggleAll} />
            Seleccionar Todo ({selectedIds.size})
          </label>
          <button onClick={handleMarcarLeidas} disabled={selectedIds.size === 0 || processing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 shadow-sm">
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Marcar como Leídas
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Componente principal: Buzón unificado con tabs ─────────────────── */
export default function Buzon({ onClose, onUpdateCount }: BuzonProps) {
  const [tab, setTab] = useState<Tab>('costos');

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Bell size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Buzón de Alertas</h3>
            <p className="text-xs text-muted-foreground">Notificaciones del sistema</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border bg-background">
        <button
          onClick={() => setTab('costos')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            tab === 'costos'
              ? 'text-primary border-b-2 border-primary bg-primary/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <TrendingUp size={15} />
          Alertas de Costo
        </button>
        <button
          onClick={() => setTab('retrasos')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            tab === 'retrasos'
              ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-500/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Clock size={15} />
          Retrasos de OC
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      {tab === 'costos'
        ? <TabCostos onUpdateCount={onUpdateCount} />
        : <TabRetrasos onUpdateCount={onUpdateCount} />
      }
    </div>
  );
}
