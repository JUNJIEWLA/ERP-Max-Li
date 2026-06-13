import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardCheck, RefreshCw, Search, X, Eye, Plus, Loader2, AlertTriangle,
  Warehouse, Package, CheckCircle2, XCircle, Clock, ChevronRight, Minus,
  Send, ShieldCheck, Ban, BarChart2, Filter, Hash
} from 'lucide-react';
import {
  conteosApi, almacenesApi, productosApi, usuariosApi,
  type ConteoResumen, type ConteoCabecera, type ConteoDetalle,
  type Almacen, type Producto, type Usuario
} from '../../imports/api';

// ── Helpers ──────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtNum = (v: number) => v.toLocaleString('es-DO');

// Zonas predefinidas (controladas en frontend, texto libre en BD)
const ZONAS_PREDEFINIDAS = [
  'Piso de Venta - Pasillo A',
  'Piso de Venta - Pasillo B',
  'Piso de Venta - Pasillo C',
  'Piso de Venta - Pasillo D',
  'Piso de Venta - Pasillo E',
  'Piso de Venta - Refrigerados',
  'Piso de Venta - Congelados',
  'Piso de Venta - Panadería',
  'Piso de Venta - Caja / Frente',
  'Tercer Nivel - Sector 1',
  'Tercer Nivel - Sector 2',
  'Tercer Nivel - Sector 3',
  'Tercer Nivel - General',
];

type ConteoEstado = 'EN_PROCESO' | 'REVISION' | 'APLICADO' | 'ANULADO';

const ESTADO_CONFIG: Record<ConteoEstado, {
  label: string; icon: any; dot: string; badge: string;
}> = {
  EN_PROCESO: { label: 'En Proceso', icon: Clock, dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  REVISION:   { label: 'En Revisión', icon: Eye, dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  APLICADO:   { label: 'Aplicado', icon: CheckCircle2, dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ANULADO:    { label: 'Anulado', icon: XCircle, dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// ── Modal: Crear Conteo ──────────────────────────────────

function CrearConteoModal({ almacenes, usuarios, onClose, onSaved }: {
  almacenes: Almacen[];
  usuarios: Usuario[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idAlmacen, setIdAlmacen] = useState('');
  const [zona, setZona] = useState('');
  const [idUsuarioAsignado, setIdUsuarioAsignado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!idAlmacen) { setError('Selecciona un almacén.'); return; }
    if (!idUsuarioAsignado) { setError('Selecciona el usuario asignado.'); return; }

    setSaving(true);
    try {
      await conteosApi.crear({
        idAlmacen: Number(idAlmacen),
        zona: zona || undefined,
        idUsuarioAsignado: Number(idUsuarioAsignado),
        observacion: observacion || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al crear el conteo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Nuevo Documento de Conteo</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Almacén */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Almacén *</label>
            <select
              id="sel-conteo-almacen"
              value={idAlmacen}
              onChange={e => setIdAlmacen(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar almacén…</option>
              {almacenes.map(a => (
                <option key={a.idAlmacen} value={String(a.idAlmacen)}>{a.nombre}</option>
              ))}
            </select>
          </div>

          {/* Zona — Dropdown controlado */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Zona / Ubicación</label>
            <select
              id="sel-conteo-zona"
              value={zona}
              onChange={e => setZona(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">General (todo el almacén)</option>
              {ZONAS_PREDEFINIDAS.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* Usuario asignado */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Asignar a *</label>
            <select
              id="sel-conteo-usuario"
              value={idUsuarioAsignado}
              onChange={e => setIdUsuarioAsignado(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar empleado…</option>
              {usuarios.map(u => (
                <option key={u.idUsuario} value={String(u.idUsuario)}>{u.username}</option>
              ))}
            </select>
          </div>

          {/* Observación */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Observación (opcional)</label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Motivo o instrucciones del conteo…"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Creando…' : 'Crear Conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Registro de Conteo (Mobile-First / Conteo Ciego) ─

interface LineaConteo {
  idProducto: number;
  nombre: string;
  sku: string;
  codigoBarras: string | null;
  cantidadFisica: number;
}

function RegistroConteoModal({ conteo, onClose, onSaved }: {
  conteo: ConteoCabecera;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lineas, setLineas] = useState<LineaConteo[]>(() =>
    (conteo.detalles || []).map(d => ({
      idProducto: d.idProducto,
      nombre: d.productoNombre,
      sku: d.productoSku,
      codigoBarras: d.productoCodigoBarras,
      cantidadFisica: d.cantidadFisica,
    }))
  );
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loadingProds, setLoadingProds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cargar productos al abrir
  useEffect(() => {
    const cargar = async () => {
      setLoadingProds(true);
      try {
        const page = await productosApi.listarActivos(0, 500);
        setProductos(page.content);
      } catch { /* ignore */ }
      finally { setLoadingProds(false); }
    };
    cargar();
  }, []);

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    const idsEnLista = new Set(lineas.map(l => l.idProducto));
    return productos.filter(p =>
      !idsEnLista.has(p.idProducto) && (
        p.nombre.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q))
      )
    ).slice(0, 8);
  }, [busqueda, productos, lineas]);

  const agregarProducto = (prod: Producto) => {
    setLineas(prev => [...prev, {
      idProducto: prod.idProducto,
      nombre: prod.nombre,
      sku: prod.sku,
      codigoBarras: prod.codigoBarras,
      cantidadFisica: 0,
    }]);
    setBusqueda('');
    setError('');
  };

  const actualizarCantidad = (idx: number, cantidad: number) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, cantidadFisica: Math.max(0, cantidad) } : l));
  };

  const incrementar = (idx: number) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, cantidadFisica: l.cantidadFisica + 1 } : l));
  };

  const decrementar = (idx: number) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, cantidadFisica: Math.max(0, l.cantidadFisica - 1) } : l));
  };

  const eliminarLinea = (idx: number) => {
    setLineas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGuardar = async () => {
    if (lineas.length === 0) { setError('Agrega al menos un producto.'); return; }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await conteosApi.registrarLineas(
        conteo.idConteo,
        lineas.map(l => ({ idProducto: l.idProducto, cantidadFisica: l.cantidadFisica }))
      );
      setSuccessMsg('Líneas guardadas correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarRevision = async () => {
    if (lineas.length === 0) { setError('No hay líneas para enviar a revisión.'); return; }
    setSending(true);
    setError('');
    try {
      // Guardar primero, luego enviar a revisión
      await conteosApi.registrarLineas(
        conteo.idConteo,
        lineas.map(l => ({ idProducto: l.idProducto, cantidadFisica: l.cantidadFisica }))
      );
      await conteosApi.enviarARevision(conteo.idConteo);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al enviar a revisión.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={17} className="text-blue-600" />
              <h2 className="text-sm sm:text-base font-semibold">Registro de Conteo</h2>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse size={12} /> {conteo.almacenNombre}</span>
              {conteo.zona && <span>📍 {conteo.zona}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        {/* Conteo ciego notice */}
        <div className="px-4 sm:px-5 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
            <ShieldCheck size={13} />
            Conteo Ciego — Las cantidades del sistema no se muestran. Registre lo que ve físicamente.
          </p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Buscador de productos */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Agregar Producto</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="input-buscar-producto-conteo"
                type="text"
                placeholder="Escanear código o buscar por nombre / SKU…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                disabled={loadingProds}
                className="w-full pl-9 pr-3 py-3 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {loadingProds && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Dropdown resultados */}
            {productosFiltrados.length > 0 && (
              <div className="mt-1 border border-border rounded-xl bg-background shadow-lg max-h-48 overflow-y-auto">
                {productosFiltrados.map(p => (
                  <button
                    key={p.idProducto}
                    onClick={() => agregarProducto(p)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}{p.codigoBarras ? ` · ${p.codigoBarras}` : ''}</p>
                    </div>
                    <Plus size={16} className="text-blue-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de productos contados — Mobile-First */}
          {lineas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Productos contados ({lineas.length})
                </p>
              </div>

              <div className="space-y-2">
                {lineas.map((l, idx) => (
                  <div
                    key={l.idProducto}
                    className="border border-border rounded-xl p-3 bg-background hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono">{l.sku}</p>
                      </div>
                      <button
                        onClick={() => eliminarLinea(idx)}
                        className="p-1 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground flex-shrink-0"
                        title="Eliminar"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Contador — Mobile-friendly con botones grandes */}
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <button
                        onClick={() => decrementar(idx)}
                        className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors active:scale-95 font-bold text-lg"
                      >
                        <Minus size={20} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={l.cantidadFisica}
                        onChange={e => actualizarCantidad(idx, parseInt(e.target.value) || 0)}
                        className="w-24 h-12 sm:h-10 px-2 border-2 border-blue-300 rounded-xl bg-blue-50 text-center text-2xl sm:text-xl font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => incrementar(idx)}
                        className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors active:scale-95 font-bold text-lg"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lineas.length === 0 && !loadingProds && (
            <div className="py-10 text-center text-muted-foreground">
              <Package size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Busca y agrega productos para comenzar el conteo.</p>
            </div>
          )}

          {/* Mensajes */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-200">
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}
        </div>

        {/* Footer — Botones grandes para móvil */}
        <div className="flex flex-col sm:flex-row gap-2 px-4 sm:px-5 py-3 sm:py-4 border-t border-border bg-muted/10 flex-shrink-0">
          <button
            onClick={handleGuardar}
            disabled={saving || sending || lineas.length === 0}
            className="flex-1 py-3 sm:py-2.5 text-sm rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
            {saving ? 'Guardando…' : 'Guardar Progreso'}
          </button>
          <button
            onClick={handleEnviarRevision}
            disabled={saving || sending || lineas.length === 0}
            className="flex-1 py-3 sm:py-2.5 text-sm rounded-xl bg-amber-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Enviando…' : 'Finalizar y Enviar a Revisión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Revisión de Discrepancias (Desktop-First) ─────

function RevisionConteoModal({ conteo, onClose, onSaved }: {
  conteo: ConteoCabecera;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [confirmApply, setConfirmApply] = useState(false);

  const detalles = conteo.detalles || [];
  const conDiscrepancia = detalles.filter(d => d.diferencia !== null && d.diferencia !== 0);
  const sinDiscrepancia = detalles.filter(d => d.diferencia === null || d.diferencia === 0);
  const totalFaltante = conDiscrepancia.filter(d => (d.diferencia ?? 0) < 0).reduce((s, d) => s + Math.abs(d.diferencia ?? 0), 0);
  const totalSobrante = conDiscrepancia.filter(d => (d.diferencia ?? 0) > 0).reduce((s, d) => s + (d.diferencia ?? 0), 0);

  const handleAplicar = async () => {
    setApplying(true);
    setError('');
    try {
      await conteosApi.aplicar(conteo.idConteo);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al aplicar el conteo.');
    } finally {
      setApplying(false);
    }
  };

  const handleAnular = async () => {
    setCancelling(true);
    setError('');
    try {
      await conteosApi.anular(conteo.idConteo);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al anular el conteo.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Eye size={17} className="text-amber-600" />
              <h2 className="text-base font-semibold">Revisión de Discrepancias — Conteo #{conteo.idConteo}</h2>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse size={12} /> {conteo.almacenNombre}</span>
              {conteo.zona && <span>📍 {conteo.zona}</span>}
              <span>👤 {conteo.usernameAsignado}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        {/* Resumen KPIs */}
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background rounded-xl px-3 py-2 border border-border">
              <p className="text-xs text-muted-foreground">Ítems contados</p>
              <p className="text-xl font-bold text-blue-600">{detalles.length}</p>
            </div>
            <div className="bg-background rounded-xl px-3 py-2 border border-border">
              <p className="text-xs text-muted-foreground">Con discrepancia</p>
              <p className="text-xl font-bold text-amber-600">{conDiscrepancia.length}</p>
            </div>
            <div className="bg-background rounded-xl px-3 py-2 border border-border">
              <p className="text-xs text-muted-foreground">Faltantes (−)</p>
              <p className="text-xl font-bold text-red-600">−{fmtNum(totalFaltante)}</p>
            </div>
            <div className="bg-background rounded-xl px-3 py-2 border border-border">
              <p className="text-xs text-muted-foreground">Sobrantes (+)</p>
              <p className="text-xl font-bold text-emerald-600">+{fmtNum(totalSobrante)}</p>
            </div>
          </div>
        </div>

        {/* Tabla comparativa */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sistema</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Físico</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {detalles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">Sin líneas de conteo</td>
                  </tr>
                ) : (
                  detalles.map(d => {
                    const diff = d.diferencia ?? 0;
                    const hasDiff = diff !== 0;
                    return (
                      <tr
                        key={d.idConteoDetalle}
                        className={`border-b border-border/50 transition-colors ${
                          hasDiff
                            ? diff < 0 ? 'bg-red-50/50' : 'bg-emerald-50/50'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.productoSku}</td>
                        <td className="px-3 py-2.5 font-medium max-w-[200px] truncate" title={d.productoNombre}>{d.productoNombre}</td>
                        <td className="px-3 py-2.5 text-center font-semibold">{d.cantidadSistema ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-blue-700">{d.cantidadFisica}</td>
                        <td className="px-3 py-2.5 text-center">
                          {hasDiff ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                              diff < 0
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <CheckCircle2 size={10} /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Confirmación de aplicar */}
        {confirmApply && (
          <div className="mx-5 mb-2 p-3 bg-amber-50 border border-amber-300 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ ¿Confirmar ajuste de inventario?</p>
            <p className="text-xs text-amber-700 mb-3">
              Esta acción actualizará {conDiscrepancia.length} existencia{conDiscrepancia.length !== 1 ? 's' : ''} al valor contado
              y generará un movimiento de AJUSTE. Esta operación no se puede revertir automáticamente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmApply(false)}
                className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicar}
                disabled={applying}
                className="flex-1 py-2 text-sm rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {applying ? 'Aplicando…' : 'Sí, Aplicar Ajustes'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!confirmApply && (
          <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
            <button onClick={onClose} className="py-2.5 px-4 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              Cerrar
            </button>
            <button
              onClick={handleAnular}
              disabled={cancelling || applying}
              className="py-2.5 px-4 text-sm rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              {cancelling ? 'Anulando…' : 'Rechazar (Anular)'}
            </button>
            <button
              onClick={() => setConfirmApply(true)}
              disabled={applying || cancelling}
              className="flex-1 py-2.5 text-sm rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              Aprobar y Aplicar Ajustes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal: Detalle de Conteo (Solo lectura) ──────────────

function DetalleConteoModal({ conteo, onClose }: {
  conteo: ConteoCabecera;
  onClose: () => void;
}) {
  const detalles = conteo.detalles || [];
  const cfg = ESTADO_CONFIG[conteo.estado as ConteoEstado] || ESTADO_CONFIG.EN_PROCESO;
  const EstadoIcon = cfg.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Detalle Conteo #{conteo.idConteo}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Info cabecera */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Almacén</p>
              <p className="font-semibold mt-0.5">{conteo.almacenNombre}</p>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Zona</p>
              <p className="font-semibold mt-0.5">{conteo.zona || 'General'}</p>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Estado</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                <EstadoIcon size={10} /> {cfg.label}
              </span>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Asignado a</p>
              <p className="font-semibold mt-0.5">{conteo.usernameAsignado}</p>
            </div>
            <div className="bg-muted/30 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Creado</p>
              <p className="font-semibold mt-0.5 text-xs">{fmtDate(conteo.fechaCreacion)}</p>
            </div>
            {conteo.fechaAplicacion && (
              <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Aplicado</p>
                <p className="font-semibold mt-0.5 text-xs">{fmtDate(conteo.fechaAplicacion)}</p>
              </div>
            )}
            {conteo.usernameSupervisor && (
              <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Supervisor</p>
                <p className="font-semibold mt-0.5">{conteo.usernameSupervisor}</p>
              </div>
            )}
          </div>

          {conteo.observacion && (
            <div className="bg-muted/30 rounded-xl px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground">Observación</p>
              <p className="mt-0.5">{conteo.observacion}</p>
            </div>
          )}

          {/* Tabla de detalles */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Líneas de conteo ({detalles.length})
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Producto</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Sistema</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Físico</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Sin líneas</td></tr>
                  ) : detalles.map(d => {
                    const diff = d.diferencia ?? 0;
                    return (
                      <tr key={d.idConteoDetalle} className={`border-b border-border/50 ${
                        diff < 0 ? 'bg-red-50/30' : diff > 0 ? 'bg-emerald-50/30' : ''
                      }`}>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.productoSku}</td>
                        <td className="px-3 py-2">{d.productoNombre}</td>
                        <td className="px-3 py-2 text-center">{d.cantidadSistema ?? '—'}</td>
                        <td className="px-3 py-2 text-center font-bold text-blue-700">{d.cantidadFisica}</td>
                        <td className="px-3 py-2 text-center">
                          {diff !== 0 ? (
                            <span className={`font-bold ${diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          ) : <span className="text-slate-400">0</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────

type EstadoFiltro = '' | 'EN_PROCESO' | 'REVISION' | 'APLICADO' | 'ANULADO';

export default function ConteoFisico() {
  const [conteos, setConteos] = useState<ConteoResumen[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('');

  // Paginación
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 15;

  // Modales
  const [showCrear, setShowCrear] = useState(false);
  const [registroConteo, setRegistroConteo] = useState<ConteoCabecera | null>(null);
  const [revisionConteo, setRevisionConteo] = useState<ConteoCabecera | null>(null);
  const [detalleConteo, setDetalleConteo] = useState<ConteoCabecera | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conteosPage, almPage, usrPage] = await Promise.all([
        estadoFiltro
          ? conteosApi.listarPorEstado(estadoFiltro, page, PAGE_SIZE)
          : conteosApi.listar(page, PAGE_SIZE),
        almacenesApi.listar(0, 100),
        usuariosApi.listarActivos(0, 100),
      ]);
      setConteos(conteosPage.content);
      setTotalPages(conteosPage.totalPages);
      setAlmacenes(almPage.content.filter(a => a.estado === 'ACTIVO'));
      setUsuarios(usrPage.content);
    } catch (e: any) {
      setError(e.message || 'Error al cargar los conteos.');
    } finally {
      setLoading(false);
    }
  }, [page, estadoFiltro]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  useEffect(() => { setPage(0); }, [estadoFiltro]);

  // Filtro local por texto
  const filtered = useMemo(() => {
    if (!search) return conteos;
    const q = search.toLowerCase();
    return conteos.filter(c =>
      c.almacenNombre.toLowerCase().includes(q) ||
      (c.zona || '').toLowerCase().includes(q) ||
      c.usernameAsignado.toLowerCase().includes(q) ||
      (c.observacion || '').toLowerCase().includes(q) ||
      String(c.idConteo).includes(q)
    );
  }, [conteos, search]);

  // KPIs
  const kpis = useMemo(() => ({
    total: conteos.length,
    enProceso: conteos.filter(c => c.estado === 'EN_PROCESO').length,
    enRevision: conteos.filter(c => c.estado === 'REVISION').length,
    aplicados: conteos.filter(c => c.estado === 'APLICADO').length,
  }), [conteos]);

  const handleVerConteo = async (id: number, modo: 'registro' | 'revision' | 'detalle') => {
    try {
      const completo = await conteosApi.buscarPorId(id);
      if (modo === 'registro') setRegistroConteo(completo);
      else if (modo === 'revision') setRevisionConteo(completo);
      else setDetalleConteo(completo);
    } catch (e: any) {
      setError(e.message || 'Error al cargar el conteo.');
    }
  };

  const handleModalClose = () => {
    setShowCrear(false);
    setRegistroConteo(null);
    setRevisionConteo(null);
    setDetalleConteo(null);
    cargarDatos();
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardCheck size={22} className="text-blue-500" />
            Conteo Físico
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de toma de inventario por zonas con conteo ciego
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
            id="btn-nuevo-conteo"
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
          >
            <Plus size={15} />
            Nuevo Conteo
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-2 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className={`bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors ${estadoFiltro === 'EN_PROCESO' ? 'ring-2 ring-blue-400' : ''}`}
          onClick={() => setEstadoFiltro(e => e === 'EN_PROCESO' ? '' : 'EN_PROCESO')}
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">En Proceso</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{loading ? '—' : kpis.enProceso}</p>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Clock size={20} />
          </div>
        </div>

        <div
          className={`bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 transition-colors ${estadoFiltro === 'REVISION' ? 'ring-2 ring-amber-400' : ''}`}
          onClick={() => setEstadoFiltro(e => e === 'REVISION' ? '' : 'REVISION')}
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">En Revisión</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.enRevision > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {loading ? '—' : kpis.enRevision}
            </p>
          </div>
          <div className={`w-10 h-10 ${kpis.enRevision > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} rounded-xl flex items-center justify-center`}>
            <Eye size={20} />
          </div>
        </div>

        <div
          className={`bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-emerald-400 transition-colors ${estadoFiltro === 'APLICADO' ? 'ring-2 ring-emerald-400' : ''}`}
          onClick={() => setEstadoFiltro(e => e === 'APLICADO' ? '' : 'APLICADO')}
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Aplicados</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{loading ? '—' : kpis.aplicados}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold mt-1">{loading ? '—' : kpis.total}</p>
          </div>
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="input-buscar-conteos"
            type="text"
            placeholder="Buscar por almacén, zona, usuario…"
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
          <Filter size={14} className="text-muted-foreground" />
          <select
            id="filtro-estado-conteo"
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value as EstadoFiltro)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="EN_PROCESO">🔵 En Proceso</option>
            <option value="REVISION">🟡 En Revisión</option>
            <option value="APLICADO">🟢 Aplicado</option>
            <option value="ANULADO">⚪ Anulado</option>
          </select>
        </div>

        {(search || estadoFiltro) && (
          <button
            onClick={() => { setSearch(''); setEstadoFiltro(''); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} conteo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla de conteos */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">#ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Almacén</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zona</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asignado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ítems</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discrep.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2" />
                    Cargando conteos…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground">
                    <ClipboardCheck size={36} className="mx-auto mb-2 opacity-30" />
                    <p>No se encontraron documentos de conteo.</p>
                    <p className="text-xs mt-1">Crea uno nuevo para comenzar la toma de inventario.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const cfg = ESTADO_CONFIG[c.estado as ConteoEstado] || ESTADO_CONFIG.EN_PROCESO;
                  const EstadoIcon = cfg.icon;

                  return (
                    <tr
                      key={c.idConteo}
                      className="border-b border-border/60 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Hash size={10} />{String(c.idConteo).padStart(4, '0')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                          <Warehouse size={10} /> {c.almacenNombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[150px] truncate" title={c.zona || 'General'}>
                        {c.zona || <span className="text-muted-foreground/50">General</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{c.usernameAsignado}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold">{c.totalItems}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.totalDiscrepancias > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                            {c.totalDiscrepancias}
                          </span>
                        ) : c.totalItems > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={10} /> 0
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.fechaCreacion)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {c.estado === 'EN_PROCESO' && (
                            <button
                              onClick={() => handleVerConteo(c.idConteo, 'registro')}
                              title="Continuar conteo"
                              className="p-1.5 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors text-muted-foreground"
                            >
                              <ClipboardCheck size={15} />
                            </button>
                          )}
                          {c.estado === 'REVISION' && (
                            <button
                              onClick={() => handleVerConteo(c.idConteo, 'revision')}
                              title="Revisar discrepancias"
                              className="p-1.5 rounded-lg hover:bg-amber-100 hover:text-amber-600 transition-colors text-muted-foreground"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          {(c.estado === 'APLICADO' || c.estado === 'ANULADO') && (
                            <button
                              onClick={() => handleVerConteo(c.idConteo, 'detalle')}
                              title="Ver detalle"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modales */}
      {showCrear && (
        <CrearConteoModal
          almacenes={almacenes}
          usuarios={usuarios}
          onClose={() => setShowCrear(false)}
          onSaved={handleModalClose}
        />
      )}

      {registroConteo && (
        <RegistroConteoModal
          conteo={registroConteo}
          onClose={() => setRegistroConteo(null)}
          onSaved={handleModalClose}
        />
      )}

      {revisionConteo && (
        <RevisionConteoModal
          conteo={revisionConteo}
          onClose={() => setRevisionConteo(null)}
          onSaved={handleModalClose}
        />
      )}

      {detalleConteo && (
        <DetalleConteoModal
          conteo={detalleConteo}
          onClose={() => setDetalleConteo(null)}
        />
      )}
    </div>
  );
}
