import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ToggleRight, ToggleLeft, Bookmark, Search, X, Loader2 } from 'lucide-react';
import { marcasApi, type Marca } from '../../imports/api';

const EMPTY_FORM = { nombre: '', descripcion: '', estado: 'ACTIVO' };

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

  const fetchMarcas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marcasApi.listar(page, PAGE_SIZE);
      setMarcas(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchMarcas(); }, [fetchMarcas]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (m: Marca) => { setEditTarget(m); setForm({ nombre: m.nombre, descripcion: m.descripcion ?? '', estado: m.estado }); setFormError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) { await marcasApi.actualizar(editTarget.idMarca, form); }
      else { await marcasApi.crear({ nombre: form.nombre, descripcion: form.descripcion }); }
      closeModal(); fetchMarcas();
    } catch (e: any) { setFormError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDesactivar = async (id: number) => {
    try { await marcasApi.desactivar(id); fetchMarcas(); } finally { setConfirmId(null); }
  };

  const filtered = marcas.filter(m =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (m.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bookmark size={24} className="text-primary" /> Marcas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalElements} marca{totalElements !== 1 ? 's' : ''} registrada{totalElements !== 1 ? 's' : ''}
          </p>
        </div>
        <button id="btn-nueva-marca" onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          <Plus size={18} /> Nueva Marca
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar marca..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bookmark size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No se encontraron marcas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">#</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Nombre</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Descripción</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m, i) => (
                <tr key={m.idMarca} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{m.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{m.descripcion || <span className="italic opacity-50">Sin descripción</span>}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.estado === 'ACTIVO' ? 'bg-green-500/15 text-green-600' : 'bg-rose-500/15 text-rose-600'}`}>
                      {m.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button id={`btn-editar-marca-${m.idMarca}`} onClick={() => openEdit(m)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil size={16} /></button>
                      <button id={`btn-toggle-marca-${m.idMarca}`} onClick={() => setConfirmId(m.idMarca)}
                        className={`p-1.5 rounded-lg transition-colors ${m.estado === 'ACTIVO' ? 'hover:bg-rose-500/10 text-rose-500' : 'hover:bg-green-500/10 text-green-500'}`}>
                        {m.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">{editTarget ? 'Editar Marca' : 'Nueva Marca'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nombre <span className="text-rose-500">*</span></label>
                <input id="input-marca-nombre" type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Nike, Samsung, Nestlé..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
                <textarea id="input-marca-descripcion" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..." rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>
              {editTarget && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                  <select id="input-marca-estado" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}
              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} /> {formError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-guardar-marca" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Marca')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">¿Desactivar marca?</h3>
            <p className="text-sm text-muted-foreground">El estado cambiará a <strong>INACTIVO</strong>.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-confirmar-desactivar-marca" onClick={() => handleDesactivar(confirmId!)}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium">Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
