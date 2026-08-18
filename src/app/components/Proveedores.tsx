import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, X, Loader2,
  Building2, Phone, Mail, MapPin, User, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, LayoutGrid, ShieldCheck, DollarSign, Save, RotateCcw,
  BadgeCheck
} from 'lucide-react';
import { proveedoresApi, dgiiApi, Proveedor } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

const EMPTY_FORM = {
  nombreEmpresa: '', rnc: '', ubicacion: '', vendedor: '',
  telefono: '', email: '', estado: 'ACTIVO',
};

const SUPPLIER_COLORS = [
  'bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-teal-600',
  'bg-cyan-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600',
];
const getSupplierColor = (name: string) => SUPPLIER_COLORS[(name || 'S').charCodeAt(0) % SUPPLIER_COLORS.length];

function StatusBadge({ estado }: { estado: string }) {
  return estado === 'ACTIVO'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><CheckCircle2 size={11} />Activo</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle size={11} />Inactivo</span>;
}

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
  const [selected, setSelected] = useState<Proveedor | null>(null);

  const [consultandoDgii, setConsultandoDgii] = useState(false);
  const [mensajeDgii, setMensajeDgii] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const handleConsultarDgii = async (rncOverride?: string) => {
    const rncToQuery = (rncOverride ?? formData.rnc).replace(/[^0-9]/g, '');
    if (!rncToQuery || (rncToQuery.length !== 9 && rncToQuery.length !== 11)) {
      setMensajeDgii({ tipo: 'error', texto: 'Ingrese un RNC (9 dígitos) o Cédula (11 dígitos) válido.' });
      return;
    }
    setConsultandoDgii(true);
    setMensajeDgii(null);
    try {
      const res = await dgiiApi.consultarRnc(rncToQuery);
      if (!res.error && res.nombreRazonSocial) {
        const nombreEncontrado = res.nombreRazonSocial || res.nombreComercial || '';
        setFormData(prev => ({
          ...prev,
          nombreEmpresa: nombreEncontrado,
          rnc: res.cedulaRnc || prev.rnc,
        }));
        setMensajeDgii({
          tipo: 'exito',
          texto: `✓ DGII: ${nombreEncontrado}${res.estado ? ` (${res.estado})` : ''}`,
        });
      } else {
        setMensajeDgii({ tipo: 'error', texto: res.mensaje || 'RNC/Cédula no registrado en la DGII.' });
      }
    } catch (e: any) {
      setMensajeDgii({ tipo: 'error', texto: e.message || 'Error al consultar DGII.' });
    } finally {
      setConsultandoDgii(false);
    }
  };

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
    setMensajeDgii(null);
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
    setMensajeDgii(null);
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
    try {
      await proveedoresApi.desactivar(id);
      fetchProveedores();
      setSelected(null);
    } finally {
      setConfirmId(null);
    }
  };

  const filtered = proveedores.filter(p =>
    p.nombreEmpresa.toLowerCase().includes(search.toLowerCase()) ||
    p.rnc.toLowerCase().includes(search.toLowerCase()) ||
    (p.vendedor ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activos = proveedores.filter(p => p.estado === 'ACTIVO').length;
  const totalBalancePendiente = proveedores.reduce((acc, p) => acc + (p.balancePendiente || 0), 0);

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Building2 size={22} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Proveedores</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión de suplidores, contactos comerciales y cuentas por pagar</p>
            </div>
          </div>
          <button
            id="btn-nuevo-proveedor"
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-semibold text-sm shadow-sm shadow-indigo-600/30 hover:shadow-md hover:shadow-indigo-600/20 hover:-translate-y-px"
          >
            <Plus size={16} /> Nuevo Proveedor
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-lg"><LayoutGrid size={18} className="text-indigo-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalElements}</p>
              <p className="text-xs text-muted-foreground">Total de proveedores</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg"><ShieldCheck size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activos}</p>
              <p className="text-xs text-muted-foreground">Proveedores activos</p>
            </div>
          </div>
          <div className="bg-background rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-lg"><DollarSign size={18} className="text-rose-600" /></div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{fmt(totalBalancePendiente)}</p>
              <p className="text-xs text-muted-foreground">Balance pendiente total</p>
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
              <input
                type="text"
                placeholder="Buscar por empresa, RNC o vendedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={32} className="animate-spin text-indigo-600" />
                <p className="text-sm text-muted-foreground">Cargando proveedores...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <div className="p-4 bg-muted/30 rounded-2xl"><Building2 size={32} className="opacity-40" /></div>
                <p className="font-medium">No se encontraron proveedores</p>
                {search && <p className="text-sm opacity-70">Prueba con otro término de búsqueda</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Contacto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Ubicación</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Balance Pendiente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr
                      key={p.idProveedor}
                      onClick={() => setSelected(selected?.idProveedor === p.idProveedor ? null : p)}
                      className={`border-b border-border cursor-pointer transition-all duration-150 ${
                        selected?.idProveedor === p.idProveedor ? 'bg-indigo-500/5 border-l-2 border-l-indigo-600' : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getSupplierColor(p.nombreEmpresa)}`}>
                            {p.nombreEmpresa.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{p.nombreEmpresa}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              SUP-{String(p.idProveedor).padStart(4, '0')} · RNC: {p.rnc}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {p.vendedor && (
                            <p className="font-medium text-foreground flex items-center gap-1.5">
                              <User size={12} className="text-indigo-500 flex-shrink-0" />
                              {p.vendedor}
                            </p>
                          )}
                          {p.telefono && (
                            <p className="flex items-center gap-1.5">
                              <Phone size={11} className="flex-shrink-0 opacity-70" />
                              {p.telefono}
                            </p>
                          )}
                          {p.email && (
                            <p className="flex items-center gap-1.5 truncate max-w-[200px]">
                              <Mail size={11} className="flex-shrink-0 opacity-70" />
                              {p.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                        {p.ubicacion ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-amber-500 flex-shrink-0" />
                            {p.ubicacion}
                          </span>
                        ) : (
                          <span className="italic opacity-40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-bold ${p.balancePendiente > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {fmt(p.balancePendiente)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge estado={p.estado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`btn-editar-proveedor-${p.idProveedor}`}
                            onClick={e => { e.stopPropagation(); openEdit(p); }}
                            className="p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            id={`btn-toggle-proveedor-${p.idProveedor}`}
                            onClick={e => { e.stopPropagation(); setConfirmId(p.idProveedor); }}
                            className={`p-2 rounded-lg transition-colors ${
                              p.estado === 'ACTIVO' ? 'hover:bg-rose-500/10 text-rose-500' : 'hover:bg-emerald-500/10 text-emerald-500'
                            }`}
                            title={p.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                          >
                            {p.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        pg === page ? 'bg-indigo-600 text-white' : 'hover:bg-muted border border-border'
                      }`}
                    >
                      {pg + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Detalle del Proveedor</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold ${getSupplierColor(selected.nombreEmpresa)}`}>
                  {selected.nombreEmpresa.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-foreground leading-tight">{selected.nombreEmpresa}</p>
                  <p className="text-xs text-muted-foreground font-mono">SUP-{String(selected.idProveedor).padStart(4, '0')}</p>
                  <div className="mt-1"><StatusBadge estado={selected.estado} /></div>
                </div>
              </div>

              <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">RNC Fiscal:</span>
                  <span className="text-xs font-mono font-semibold">{selected.rnc}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Balance Pendiente:</span>
                  <span className={`text-sm font-mono font-bold ${selected.balancePendiente > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {fmt(selected.balancePendiente)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto y Dirección</p>
                {selected.vendedor && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <User size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vendedor / Asesor</p>
                      <p className="font-medium">{selected.vendedor}</p>
                    </div>
                  </div>
                )}
                {selected.telefono && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <Phone size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="font-medium font-mono">{selected.telefono}</p>
                    </div>
                  </div>
                )}
                {selected.email && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <Mail size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Correo electrónico</p>
                      <p className="font-medium break-all">{selected.email}</p>
                    </div>
                  </div>
                )}
                {selected.ubicacion && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ubicación</p>
                      <p className="font-medium">{selected.ubicacion}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  onClick={() => setConfirmId(selected.idProveedor)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
                    selected.estado === 'ACTIVO'
                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
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
              <div className={`p-2.5 rounded-xl ${editTarget ? 'bg-amber-500/10' : 'bg-indigo-500/10'}`}>
                {editTarget ? <Pencil size={18} className="text-amber-600" /> : <Building2 size={18} className="text-indigo-600" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{editTarget ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                <p className="text-xs text-muted-foreground">{editTarget ? `Modificando: ${editTarget.nombreEmpresa}` : 'Ingresa los datos del nuevo suplidor'}</p>
              </div>
              <button onClick={closeModal} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* RNC primero con botón DGII */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-foreground">
                      RNC / Cédula <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleConsultarDgii()}
                      disabled={consultandoDgii || !formData.rnc.trim()}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      {consultandoDgii ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Consultando DGII…
                        </>
                      ) : (
                        <>
                          <Search size={12} />
                          Consultar DGII
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    id="input-proveedor-rnc"
                    type="text"
                    value={formData.rnc}
                    onChange={e => {
                      setFormData(f => ({ ...f, rnc: e.target.value }));
                      setMensajeDgii(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConsultarDgii();
                      }
                    }}
                    onBlur={e => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      if ((clean.length === 9 || clean.length === 11) && !formData.nombreEmpresa.trim()) {
                        handleConsultarDgii(clean);
                      }
                    }}
                    placeholder="Ej: 101000000 o 131-99603-5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                    autoFocus={!editTarget}
                  />
                  {mensajeDgii && (
                    <p className={`text-xs font-medium mt-1 ${mensajeDgii.tipo === 'exito' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {mensajeDgii.texto}
                    </p>
                  )}
                </div>

                {/* Empresa / Razón Social (SEGUNDO - Auto-completado) */}
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Empresa / Razón Social <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-proveedor-empresa"
                    type="text"
                    value={formData.nombreEmpresa}
                    onChange={e => setFormData(f => ({ ...f, nombreEmpresa: e.target.value }))}
                    placeholder="Se auto-completa al consultar DGII o ingrese manualmente"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Vendedor / Contacto</label>
                  <input
                    id="input-proveedor-vendedor"
                    type="text"
                    value={formData.vendedor}
                    onChange={e => setFormData(f => ({ ...f, vendedor: e.target.value }))}
                    placeholder="Nombre del ejecutivo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Teléfono</label>
                  <input
                    id="input-proveedor-telefono"
                    type="text"
                    value={formData.telefono}
                    onChange={e => setFormData(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="809-555-0199"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Correo Electrónico</label>
                  <input
                    id="input-proveedor-email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="ventas@suplidor.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Ubicación / Dirección</label>
                <input
                  id="input-proveedor-ubicacion"
                  type="text"
                  value={formData.ubicacion}
                  onChange={e => setFormData(f => ({ ...f, ubicacion: e.target.value }))}
                  placeholder="Av. Winston Churchill #105, Santo Domingo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              {editTarget && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Estado</label>
                  <select
                    id="input-proveedor-estado"
                    value={formData.estado}
                    onChange={e => setFormData(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
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
              <button
                id="btn-guardar-proveedor"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-sm font-semibold disabled:opacity-60 shadow-sm shadow-indigo-600/30"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar' : 'Crear Proveedor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Deactivate ───────────────────────── */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertCircle size={22} className="text-rose-500" /></div>
              <div>
                <h3 className="font-bold text-foreground">¿Desactivar proveedor?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Esta acción deshabilita nuevas compras</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">El proveedor pasará a estado <strong className="text-foreground">INACTIVO</strong>.</p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium">Cancelar</button>
              <button
                id="btn-confirmar-desactivar-proveedor"
                onClick={() => handleToggle(confirmId!)}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-semibold"
              >
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
