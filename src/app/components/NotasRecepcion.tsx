import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Loader2, PackageCheck, Search, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { notasRecepcionApi, ordenesCompraApi, OrdenCompra, NotaRecepcion } from '../../imports/api';

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE:  'bg-amber-500/15 text-amber-700',
  CONFIRMADA: 'bg-green-500/15 text-green-600',
  RECHAZADA:  'bg-rose-500/15 text-rose-600',
};

const OBS_BADGE: Record<string, string> = {
  CONFORME:  'bg-green-500/15 text-green-600',
  DAÑADO:    'bg-rose-500/15 text-rose-600',
  INCOMPLETO:'bg-amber-500/15 text-amber-700',
};

type LineaRecepcion = {
  idDetalleOrdenCompra: number;
  nombreProducto: string;
  cantidadPendiente: number;
  cantidadRecibida: number;
  observacion: string;
  notas: string;
};

export default function NotasRecepcion() {
  const [notas, setNotas] = useState<NotaRecepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 15;

  const [showModal, setShowModal] = useState(false);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [idOrdenSel, setIdOrdenSel] = useState('');
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenCompra | null>(null);
  const [lineas, setLineas] = useState<LineaRecepcion[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadingOrden, setLoadingOrden] = useState(false);

  const [confirmNota, setConfirmNota] = useState<{ id: number; accion: 'confirmar' | 'rechazar' } | null>(null);

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
      // Órdenes en estado ENVIADA o RECEPCION_PARCIAL
      const [env, parc] = await Promise.all([
        ordenesCompraApi.listar(0, 100),
        ordenesCompraApi.listar(0, 100),
      ]);
      const aptas = env.content.filter(o =>
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
    if (!idOrdenSel) { setFormError('Selecciona una orden'); return; }
    if (lineas.length === 0) { setFormError('No hay ítems pendientes de recibir'); return; }
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

  const filtered = notas.filter(n =>
    String(n.idOrdenCompra).includes(search) ||
    String(n.idNotaRecepcion).includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PackageCheck size={26} className="text-primary" /> Notas de Recepción
          </h2>
        </div>
        <button id="btn-nueva-nota" onClick={openModal}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          <Plus size={18} /> Nueva Recepción
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por #nota u #orden..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
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
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#Nota</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#Orden</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Productos</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(n => (
                <tr key={n.idNotaRecepcion} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">NR-{String(n.idNotaRecepcion).padStart(4, '0')}</td>
                  <td className="px-4 py-3 font-mono text-xs">OC-{String(n.idOrdenCompra).padStart(4, '0')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[n.estado] ?? 'bg-muted text-muted-foreground'}`}>
                      {n.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {n.detalles.map(d => (
                        <span key={d.idDetalleNotaRecepcion}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${OBS_BADGE[d.observacion] ?? 'bg-muted text-muted-foreground'}`}>
                          {d.nombreProducto} ×{d.cantidadRecibida}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(n.fechaRecepcion).toLocaleDateString('es-DO')}
                  </td>
                  <td className="px-4 py-3">
                    {n.estado === 'PENDIENTE' && (
                      <div className="flex items-center justify-center gap-2">
                        <button id={`btn-confirmar-nota-${n.idNotaRecepcion}`}
                          onClick={() => setConfirmNota({ id: n.idNotaRecepcion, accion: 'confirmar' })}
                          title="Confirmar recepción"
                          className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors">
                          <CheckCircle2 size={16} />
                        </button>
                        <button id={`btn-rechazar-nota-${n.idNotaRecepcion}`}
                          onClick={() => setConfirmNota({ id: n.idNotaRecepcion, accion: 'rechazar' })}
                          title="Rechazar recepción"
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-600 transition-colors">
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
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

      {/* Modal Nueva Nota */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold">Nueva Nota de Recepción</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium mb-1">Orden de Compra <span className="text-rose-500">*</span></label>
                <select id="sel-orden-nota" value={idOrdenSel} onChange={e => onOrdenChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Seleccionar orden...</option>
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
                  <p className="text-sm font-medium mb-2">Productos pendientes de recibir</p>
                  <div className="space-y-2">
                    {lineas.map((ln, i) => (
                      <div key={ln.idDetalleOrdenCompra} className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{ln.nombreProducto}</span>
                          <span className="text-xs text-muted-foreground">Pendiente: {ln.cantidadPendiente}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cantidad recibida</label>
                            <input type="number" min={1} max={ln.cantidadPendiente} value={ln.cantidadRecibida}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, cantidadRecibida: Math.min(ln.cantidadPendiente, parseInt(e.target.value) || 1) } : x))}
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Estado físico</label>
                            <select value={ln.observacion}
                              onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, observacion: e.target.value } : x))}
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
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
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-crear-nota" onClick={handleCrear} disabled={saving || lineas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Registrando...' : 'Registrar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Accion */}
      {confirmNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${confirmNota.accion === 'confirmar' ? 'bg-green-500/10' : 'bg-rose-500/10'}`}>
                {confirmNota.accion === 'confirmar'
                  ? <CheckCircle2 size={20} className="text-green-600" />
                  : <AlertTriangle size={20} className="text-rose-500" />}
              </div>
              <h3 className="text-lg font-bold">
                {confirmNota.accion === 'confirmar' ? '¿Confirmar recepción?' : '¿Rechazar recepción?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmNota.accion === 'confirmar'
                ? 'Se actualizará el inventario con las cantidades CONFORMES. Esta acción no se puede deshacer.'
                : 'La nota quedará RECHAZADA y no se actualizará el inventario.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmNota(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button id="btn-confirmar-accion-nota" onClick={handleAccion}
                className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
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
