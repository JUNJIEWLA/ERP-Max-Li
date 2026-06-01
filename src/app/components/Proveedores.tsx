import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, X, Loader2,
  Building2, Phone, Mail, MapPin, User, AlertTriangle
} from 'lucide-react';
import { proveedoresApi, Proveedor } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n);

const EMPTY_FORM = {
  nombreEmpresa: '', rnc: '', ubicacion: '', vendedor: '',
  telefono: '', email: '', estado: 'ACTIVO',
};

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 10;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Proveedor | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const fetchProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await proveedoresApi.listar(page, PAGE_SIZE);
      setProveedores(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchProveedores(); }, [fetchProveedores]);

  const openCreate = () => {
    setEditTarget(null);
    setFormData({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (p: Proveedor) => {
    setEditTarget(p);
    setFormData({
      nombreEmpresa: p.nombreEmpresa,
      rnc: p.rnc,
      ubicacion: p.ubicacion ?? '',
      vendedor: p.vendedor ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      estado: p.estado,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!formData.nombreEmpresa.trim()) { setFormError('El nombre de la empresa es obligatorio'); return; }
    if (!formData.rnc.trim()) { setFormError('El RNC es obligatorio'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await proveedoresApi.actualizar(editTarget.idProveedor, formData);
      } else {
        await proveedoresApi.crear(formData);
      }
      closeModal();
      fetchProveedores();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try { await proveedoresApi.desactivar(id); fetchProveedores(); }
    finally { setConfirmId(null); }
  };

  const filtered = proveedores.filter(p =>
    p.nombreEmpresa.toLowerCase().includes(search.toLowerCase()) ||
    p.rnc.toLowerCase().includes(search.toLowerCase()) ||
    (p.vendedor ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 size={26} className="text-primary" />
            Proveedores
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalElements} proveedor{totalElements !== 1 ? 'es' : ''} registrado{totalElements !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="btn-nuevo-proveedor"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por empresa, RNC o vendedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron proveedores</p>
          {search && <p className="text-sm mt-1">Intenta con otro término</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.idProveedor} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:shadow-md transition-shadow">
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-primary/70 mb-0.5">
                    SUP-{String(p.idProveedor).padStart(4, '0')}
                  </p>
                  <h3 className="font-semibold text-foreground truncate">{p.nombreEmpresa}</h3>
                  <p className="text-xs text-muted-foreground">RNC: {p.rnc}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.estado === 'ACTIVO' ? 'bg-green-500/15 text-green-600' : 'bg-rose-500/15 text-rose-600'
                }`}>{p.estado}</span>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {p.vendedor && (
                  <div className="flex items-center gap-2">
                    <User size={13} className="shrink-0" />
                    <span className="truncate">{p.vendedor}</span>
                  </div>
                )}
                {p.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0" />
                    <span>{p.telefono}</span>
                  </div>
                )}
                {p.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
                {p.ubicacion && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{p.ubicacion}</span>
                  </div>
                )}
              </div>

              {/* Balance */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Balance Pendiente:</span>
                <span className={`text-sm font-bold ${p.balancePendiente > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {fmt(p.balancePendiente)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  id={`btn-editar-proveedor-${p.idProveedor}`}
                  onClick={() => openEdit(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  id={`btn-toggle-proveedor-${p.idProveedor}`}
                  onClick={() => setConfirmId(p.idProveedor)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    p.estado === 'ACTIVO'
                      ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                      : 'border border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {p.estado === 'ACTIVO' ? <><ToggleRight size={13} /> Desactivar</> : <><ToggleLeft size={13} /> Activar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
              Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold">{editTarget ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Empresa & RNC */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Empresa <span className="text-rose-500">*</span></label>
                  <input id="input-proveedor-empresa" type="text" value={formData.nombreEmpresa}
                    onChange={e => setFormData(f => ({ ...f, nombreEmpresa: e.target.value }))}
                    placeholder="Nombre de la empresa"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RNC <span className="text-rose-500">*</span></label>
                  <input id="input-proveedor-rnc" type="text" value={formData.rnc}
                    onChange={e => setFormData(f => ({ ...f, rnc: e.target.value }))}
                    placeholder="000-00000-0"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vendedor</label>
                  <input id="input-proveedor-vendedor" type="text" value={formData.vendedor}
                    onChange={e => setFormData(f => ({ ...f, vendedor: e.target.value }))}
                    placeholder="Nombre del contacto"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input id="input-proveedor-telefono" type="text" value={formData.telefono}
                    onChange={e => setFormData(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="000-000-0000"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input id="input-proveedor-email" type="email" value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="correo@empresa.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ubicación</label>
                <input id="input-proveedor-ubicacion" type="text" value={formData.ubicacion}
                  onChange={e => setFormData(f => ({ ...f, ubicacion: e.target.value }))}
                  placeholder="Dirección o ciudad"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              {editTarget && (
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select id="input-proveedor-estado" value={formData.estado}
                    onChange={e => setFormData(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}
              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-0 border-t border-border">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-guardar-proveedor" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Proveedor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg"><AlertTriangle size={20} className="text-rose-500" /></div>
              <h3 className="text-lg font-bold">¿Desactivar proveedor?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              El proveedor pasará a estado <strong>INACTIVO</strong> y no podrán crearse nuevas órdenes para él.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-confirmar-desactivar-proveedor" onClick={() => handleToggle(confirmId!)}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium">
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
