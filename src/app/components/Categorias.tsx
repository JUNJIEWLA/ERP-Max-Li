import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Tag, Search, X, Loader2, Percent,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  TrendingUp, LayoutGrid, ShieldCheck, AlertCircle,
  Save, RotateCcw
} from 'lucide-react';
import { categoriasApi, type Categoria } from '../../imports/api';

const EMPTY_FORM = { nombre: '', descripcion: '', estado: 'ACTIVO', porcentajeMargen: '', porcentajeMargenMayor: '' };

const COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];
const getColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

function StatusBadge({ estado }: { estado: string }) {
  return estado === 'ACTIVO'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><CheckCircle2 size={11} />Activo</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle size={11} />Inactivo</span>;
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 10;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Categoria | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Categoria | null>(null);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoriasApi.listar(page, PAGE_SIZE);
      setCategorias(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (c: Categoria) => {
    setEditTarget(c);
    setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', estado: c.estado, porcentajeMargen: String(c.porcentajeMargen ?? 0), porcentajeMargenMayor: String(c.porcentajeMargenMayor ?? 0) });
    setFormError(''); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true); setFormError('');
    try {
      const margenNum = form.porcentajeMargen ? Number(form.porcentajeMargen) : 0;
      const margenMayorNum = form.porcentajeMargenMayor ? Number(form.porcentajeMargenMayor) : 0;
      if (editTarget) {
        await categoriasApi.actualizar(editTarget.idCategoria, { ...form, porcentajeMargen: margenNum, porcentajeMargenMayor: margenMayorNum });
      } else {
        await categoriasApi.crear({ nombre: form.nombre, descripcion: form.descripcion, porcentajeMargen: margenNum, porcentajeMargenMayor: margenMayorNum });
      }
      closeModal(); fetchCategorias();
    } catch (e: any) { setFormError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDesactivar = async (id: number) => {
    try { await categoriasApi.desactivar(id); fetchCategorias(); setSelected(null); }
    finally { setConfirmId(null); }
  };

  const filtered = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activas = categorias.filter(c => c.estado === 'ACTIVO').length;
  const conMargen = categorias.filter(c => (c.porcentajeMargen ?? 0) > 0).length;

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Tag size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Categorías de Productos</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión de clasificación y márgenes de ganancia</p>
            </div>
          </div>
          <button id="btn-nueva-categoria" onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all font-semibold text-sm shadow-sm shadow-primary/30 hover:shadow-md hover:shadow-primary/20 hover:-translate-y-px">
            <Plus size={16} /> Nueva Categoría
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg"><LayoutGrid size={18} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total categorías</p>
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
            <div className="p-2.5 bg-violet-500/10 rounded-lg"><TrendingUp size={18} className="text-violet-600" /></div>
            <div>
              <p className="text-2xl font-bold text-violet-600">{conMargen}</p>
              <p className="text-xs text-muted-foreground">Con margen configurado</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Table panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/50">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar por nombre o descripción..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={13} /></button>}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Cargando categorías...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><Tag size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron categorías</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término de búsqueda</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margen Detalle</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margen Mayor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.idCategoria}
                      onClick={() => setSelected(selected?.idCategoria === c.idCategoria ? null : c)}
                      className={`border-b border-border cursor-pointer transition-all duration-150 ${selected?.idCategoria === c.idCategoria ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getColor(c.nombre)}`}>
                            {c.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">{c.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell max-w-xs truncate">
                        {c.descripcion || <span className="italic opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(c.porcentajeMargen ?? 0) > 0
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><Percent size={9} />{c.porcentajeMargen}%</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(c.porcentajeMargenMayor ?? 0) > 0
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 border border-violet-500/20"><Percent size={9} />{c.porcentajeMargenMayor}%</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge estado={c.estado} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button id={`btn-editar-cat-${c.idCategoria}`}
                            onClick={e => { e.stopPropagation(); openEdit(c); }}
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button id={`btn-toggle-cat-${c.idCategoria}`}
                            onClick={e => { e.stopPropagation(); setConfirmId(c.idCategoria); }}
                            className={`p-2 rounded-lg transition-colors ${c.estado === 'ACTIVO' ? 'hover:bg-rose-500/10 text-rose-500' : 'hover:bg-emerald-500/10 text-emerald-500'}`}
                            title={c.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}>
                            {c.estado === 'ACTIVO' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
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
              <span className="text-xs text-muted-foreground">
                Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong> — {totalElements} registros
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted border border-border'}`}>
                      {pg + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        {selected && (
          <div className="w-72 flex-shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Detalle</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold ${getColor(selected.nombre)}`}>
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Márgenes de Ganancia</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-emerald-500/5 rounded-lg px-3 py-2.5 border border-emerald-500/15">
                    <span className="text-xs text-emerald-700 font-medium">Al Detalle</span>
                    <span className="text-sm font-bold text-emerald-600">{selected.porcentajeMargen ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between bg-violet-500/5 rounded-lg px-3 py-2.5 border border-violet-500/15">
                    <span className="text-xs text-violet-700 font-medium">Al Mayor</span>
                    <span className="text-sm font-bold text-violet-600">{selected.porcentajeMargenMayor ?? 0}%</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setConfirmId(selected.idCategoria)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors border ${selected.estado === 'ACTIVO' ? 'border-rose-200 text-rose-500 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                  {selected.estado === 'ACTIVO' ? <><XCircle size={14} /> Desactivar</> : <><CheckCircle2 size={14} /> Activar</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Crear/Editar ───────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <div className={`p-2.5 rounded-xl ${editTarget ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                {editTarget ? <Pencil size={18} className="text-amber-600" /> : <Plus size={18} className="text-primary" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{editTarget ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                <p className="text-xs text-muted-foreground">{editTarget ? `Modificando: ${editTarget.nombre}` : 'Completa los campos requeridos'}</p>
              </div>
              <button onClick={closeModal} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Nombre <span className="text-rose-500">*</span>
                </label>
                <input id="input-cat-nombre" type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Electrónica, Ropa, Alimentos..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all" />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Descripción</label>
                <textarea id="input-cat-descripcion" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción opcional de la categoría..." rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 resize-none transition-all" />
              </div>

              {/* Márgenes */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Márgenes de Ganancia</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Al Detalle (%)
                    </label>
                    <div className="relative">
                      <input id="input-cat-margen" type="number" min="0" max="999.99" step="0.01"
                        value={form.porcentajeMargen}
                        onChange={e => setForm(f => ({ ...f, porcentajeMargen: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all" />
                      <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span> Al Mayor (%)
                    </label>
                    <div className="relative">
                      <input id="input-cat-margen-mayor" type="number" min="0" max="999.99" step="0.01"
                        value={form.porcentajeMargenMayor}
                        onChange={e => setForm(f => ({ ...f, porcentajeMargenMayor: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all" />
                      <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Los productos de esta categoría usarán estos márgenes para calcular precios automáticamente</p>
              </div>

              {/* Estado (solo en edición) */}
              {editTarget && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Estado</label>
                  <select id="input-cat-estado" value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all">
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
              <button id="btn-guardar-categoria" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-semibold disabled:opacity-60 shadow-sm shadow-primary/30">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Categoría')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Desactivar ───────────────── */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertCircle size={22} className="text-rose-500" /></div>
              <div>
                <h3 className="font-bold text-foreground">¿Desactivar categoría?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Esta acción se puede revertir</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">El estado cambiará a <strong className="text-foreground">INACTIVO</strong>. Los productos asociados no se verán afectados.</p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">Cancelar</button>
              <button id="btn-confirmar-desactivar-cat" onClick={() => handleDesactivar(confirmId!)}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-semibold">
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
