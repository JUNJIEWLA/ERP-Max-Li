import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Bookmark, Search, X, Loader2,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  ShieldCheck, LayoutGrid, Award, AlertCircle, Save, RotateCcw
} from 'lucide-react';
import { marcasApi, type Marca } from '../../imports/api';

const EMPTY_FORM = { nombre: '', descripcion: '', estado: 'ACTIVO' };

const BRAND_COLORS = [
  'bg-sky-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  'bg-pink-500', 'bg-lime-500', 'bg-fuchsia-500', 'bg-red-500',
];
const getBrandColor = (name: string) => BRAND_COLORS[name.charCodeAt(0) % BRAND_COLORS.length];

function StatusBadge({ estado }: { estado: string }) {
  return estado === 'ACTIVO'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><CheckCircle2 size={11} />Activo</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle size={11} />Inactivo</span>;
}

export default function Marcas() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 10;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Marca | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Marca | null>(null);

  const fetchMarcas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marcasApi.listar(page, PAGE_SIZE);
      setMarcas(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchMarcas(); }, [fetchMarcas]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (m: Marca) => { setEditTarget(m); setForm({ nombre: m.nombre, descripcion: m.descripcion ?? '', estado: m.estado }); setFormError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) await marcasApi.actualizar(editTarget.idMarca, form);
      else await marcasApi.crear({ nombre: form.nombre, descripcion: form.descripcion });
      closeModal(); fetchMarcas();
    } catch (e: any) { setFormError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDesactivar = async (id: number) => {
    try { await marcasApi.desactivar(id); fetchMarcas(); setSelected(null); }
    finally { setConfirmId(null); }
  };

  const filtered = marcas.filter(m =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (m.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activas = marcas.filter(m => m.estado === 'ACTIVO').length;

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 rounded-xl">
              <Bookmark size={22} className="text-sky-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Marcas</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión de marcas y fabricantes de productos</p>
            </div>
          </div>
          <button id="btn-nueva-marca" onClick={openCreate}
            className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl hover:bg-sky-700 transition-all font-semibold text-sm shadow-sm shadow-sky-600/30 hover:shadow-md hover:shadow-sky-600/20 hover:-translate-y-px">
            <Plus size={16} /> Nueva Marca
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 rounded-lg"><LayoutGrid size={18} className="text-sky-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total marcas</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><ShieldCheck size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activas}</p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-lg"><Award size={18} className="text-rose-500" /></div>
            <div>
              <p className="text-2xl font-bold text-rose-500">{totalElements - activas}</p>
              <p className="text-xs text-muted-foreground">Inactivas</p>
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
              <input type="text" placeholder="Buscar por nombre o descripción..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={13} /></button>}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={32} className="animate-spin text-sky-600" />
                <p className="text-sm text-muted-foreground">Cargando marcas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><Bookmark size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron marcas</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término de búsqueda</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marca</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.idMarca}
                      onClick={() => setSelected(selected?.idMarca === m.idMarca ? null : m)}
                      className={`border-b border-border cursor-pointer transition-all duration-150 ${selected?.idMarca === m.idMarca ? 'bg-sky-500/5 border-l-2 border-l-sky-500' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getBrandColor(m.nombre)}`}>
                            {m.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{m.nombre}</p>
                            <p className="text-xs text-muted-foreground">ID #{m.idMarca}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell max-w-xs truncate">
                        {m.descripcion || <span className="italic opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge estado={m.estado} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button id={`btn-editar-marca-${m.idMarca}`}
                            onClick={e => { e.stopPropagation(); openEdit(m); }}
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button id={`btn-toggle-marca-${m.idMarca}`}
                            onClick={e => { e.stopPropagation(); setConfirmId(m.idMarca); }}
                            className={`p-2 rounded-lg transition-colors ${m.estado === 'ACTIVO' ? 'hover:bg-rose-500/10 text-rose-500' : 'hover:bg-emerald-500/10 text-emerald-500'}`}
                            title={m.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}>
                            {m.estado === 'ACTIVO' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
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
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-sky-600 text-white' : 'hover:bg-muted border border-border'}`}>{pg + 1}</button>;
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
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold ${getBrandColor(selected.nombre)}`}>
                  {selected.nombre.charAt(0).toUpperCase()}
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
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">ID Interno</p>
                <p className="text-sm font-mono text-foreground">#{selected.idMarca}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setConfirmId(selected.idMarca)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors border ${selected.estado === 'ACTIVO' ? 'border-rose-200 text-rose-500 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                  {selected.estado === 'ACTIVO' ? <><XCircle size={14} />Desactivar</> : <><CheckCircle2 size={14} />Activar</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className={`p-2.5 rounded-xl ${editTarget ? 'bg-amber-500/10' : 'bg-sky-500/10'}`}>
                {editTarget ? <Pencil size={18} className="text-amber-600" /> : <Plus size={18} className="text-sky-600" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{editTarget ? 'Editar Marca' : 'Nueva Marca'}</h3>
                <p className="text-xs text-muted-foreground">{editTarget ? `Modificando: ${editTarget.nombre}` : 'Completa los campos requeridos'}</p>
              </div>
              <button onClick={closeModal} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Nombre <span className="text-rose-500">*</span></label>
                <input id="input-marca-nombre" type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Nike, Samsung, Nestlé..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Descripción</label>
                <textarea id="input-marca-descripcion" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..." rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 resize-none transition-all" />
              </div>
              {editTarget && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Estado</label>
                  <select id="input-marca-estado" value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all">
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
              <button id="btn-guardar-marca" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-all text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Marca')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertCircle size={22} className="text-rose-500" /></div>
              <div><h3 className="font-bold text-foreground">¿Desactivar marca?</h3><p className="text-xs text-muted-foreground mt-0.5">Esta acción se puede revertir</p></div>
            </div>
            <p className="text-sm text-muted-foreground">El estado cambiará a <strong className="text-foreground">INACTIVO</strong>.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">Cancelar</button>
              <button id="btn-confirmar-desactivar-marca" onClick={() => handleDesactivar(confirmId!)}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-semibold">Sí, desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
