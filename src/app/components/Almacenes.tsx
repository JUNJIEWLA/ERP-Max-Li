import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Warehouse, Search, X, Loader2,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  ShieldCheck, MapPin, ToggleRight, ToggleLeft, AlertCircle, Save, RotateCcw,
  Building2, CalendarClock
} from 'lucide-react';
import { almacenesApi, type Almacen } from '../../imports/api';

const EMPTY_FORM = { nombre: '', descripcion: '', estado: 'ACTIVO' };

function StatusBadge({ estado }: { estado: string }) {
  return estado === 'ACTIVO'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><CheckCircle2 size={11} />Activo</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle size={11} />Inactivo</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 10;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Almacen | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Almacen | null>(null);

  const fetchAlmacenes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await almacenesApi.listar(page, PAGE_SIZE);
      setAlmacenes(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchAlmacenes(); }, [fetchAlmacenes]);

  const openCreate = () => { setEditTarget(null); setFormData(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (a: Almacen) => { setEditTarget(a); setFormData({ nombre: a.nombre, descripcion: a.descripcion ?? '', estado: a.estado }); setFormError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!formData.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) await almacenesApi.actualizar(editTarget.idAlmacen, formData);
      else await almacenesApi.crear(formData);
      closeModal(); fetchAlmacenes();
    } catch (err: any) { setFormError(err.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id: number) => {
    try { await almacenesApi.desactivar(id); fetchAlmacenes(); setSelected(null); }
    finally { setConfirmId(null); }
  };

  const filtered = almacenes.filter(a =>
    a.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (a.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activos = almacenes.filter(a => a.estado === 'ACTIVO').length;

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Warehouse size={22} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Almacenes</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión de ubicaciones y centros de distribución</p>
            </div>
          </div>
          <button id="btn-nuevo-almacen" onClick={openCreate}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700 transition-all font-semibold text-sm shadow-sm shadow-amber-600/30 hover:shadow-md hover:shadow-amber-600/20 hover:-translate-y-px">
            <Plus size={16} /> Nuevo Almacén
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-lg"><Building2 size={18} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total almacenes</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><ShieldCheck size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activos}</p>
              <p className="text-xs text-muted-foreground">En operación</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-lg"><MapPin size={18} className="text-rose-500" /></div>
            <div>
              <p className="text-2xl font-bold text-rose-500">{totalElements - activos}</p>
              <p className="text-xs text-muted-foreground">Inactivos</p>
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
              <input type="text" placeholder="Buscar almacén..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={13} /></button>}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={32} className="animate-spin text-amber-600" />
                <p className="text-sm text-muted-foreground">Cargando almacenes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><Warehouse size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron almacenes</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término</p>}
                {!search && (
                  <button onClick={openCreate}
                    className="mt-2 flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                    <Plus size={14} /> Crear primer almacén
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Almacén</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Creado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.idAlmacen}
                      onClick={() => setSelected(selected?.idAlmacen === a.idAlmacen ? null : a)}
                      className={`border-b border-border cursor-pointer transition-all duration-150 ${selected?.idAlmacen === a.idAlmacen ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                            <Warehouse size={17} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{a.nombre}</p>
                            <p className="text-xs text-muted-foreground">ID #{a.idAlmacen}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell max-w-xs truncate">
                        {a.descripcion || <span className="italic opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatDate(a.fechaCreacion)}</span>
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge estado={a.estado} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button id={`btn-editar-almacen-${a.idAlmacen}`}
                            onClick={e => { e.stopPropagation(); openEdit(a); }}
                            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-600 transition-colors" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button id={`btn-toggle-almacen-${a.idAlmacen}`}
                            onClick={e => { e.stopPropagation(); setConfirmId(a.idAlmacen); }}
                            className={`p-2 rounded-lg transition-colors ${a.estado === 'ACTIVO' ? 'hover:bg-rose-500/10 text-rose-500' : 'hover:bg-emerald-500/10 text-emerald-500'}`}
                            title={a.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}>
                            {a.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/50 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong></span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-amber-600 text-white' : 'hover:bg-muted border border-border'}`}>{pg + 1}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        {selected && (
          <div className="w-64 flex-shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Detalle</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Warehouse size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{selected.nombre}</p>
                  <StatusBadge estado={selected.estado} />
                </div>
              </div>
              {selected.descripcion && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-foreground">{selected.descripcion}</p>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock size={12} />
                  <span>Creado: {formatDate(selected.fechaCreacion)}</span>
                </div>
                {selected.fechaModificacion && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock size={12} />
                    <span>Modificado: {formatDate(selected.fechaModificacion)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setConfirmId(selected.idAlmacen)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors border ${selected.estado === 'ACTIVO' ? 'border-rose-200 text-rose-500 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                  {selected.estado === 'ACTIVO' ? <><XCircle size={14} />Desactivar</> : <><CheckCircle2 size={14} />Activar</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Crear/Editar ───────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className={`p-2.5 rounded-xl ${editTarget ? 'bg-amber-500/10' : 'bg-amber-500/10'}`}>
                {editTarget ? <Pencil size={18} className="text-amber-600" /> : <Warehouse size={18} className="text-amber-600" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{editTarget ? 'Editar Almacén' : 'Nuevo Almacén'}</h3>
                <p className="text-xs text-muted-foreground">{editTarget ? `Modificando: ${editTarget.nombre}` : 'Registra un nuevo almacén o bodega'}</p>
              </div>
              <button onClick={closeModal} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Nombre <span className="text-rose-500">*</span></label>
                <input id="input-almacen-nombre" type="text" value={formData.nombre}
                  onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Almacén Principal, Bodega Sur..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Descripción</label>
                <textarea id="input-almacen-descripcion" value={formData.descripcion}
                  onChange={e => setFormData(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Dirección, capacidad, uso específico..." rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 resize-none transition-all" />
              </div>
              {editTarget && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Estado</label>
                  <select id="input-almacen-estado" value={formData.estado}
                    onChange={e => setFormData(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}
              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/8 border border-rose-500/20 px-3.5 py-2.5 rounded-xl">
                  <AlertCircle size={15} className="flex-shrink-0" /> {formError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">
                <RotateCcw size={14} /> Cancelar
              </button>
              <button id="btn-guardar-almacen" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-all text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Almacén')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm ─────────────────────────────────── */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertCircle size={22} className="text-rose-500" /></div>
              <div><h3 className="font-bold text-foreground">¿Desactivar almacén?</h3><p className="text-xs text-muted-foreground mt-0.5">Podrás reactivarlo editándolo</p></div>
            </div>
            <p className="text-sm text-muted-foreground">El estado cambiará a <strong className="text-foreground">INACTIVO</strong>.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">Cancelar</button>
              <button id="btn-confirmar-desactivar" onClick={() => handleToggle(confirmId!)}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-semibold">Sí, desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
