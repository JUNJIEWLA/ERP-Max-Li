import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Edit2, UserX, UserCheck,
  Phone, Mail, MapPin, FileText, Percent, TrendingUp, X, Save, Loader2, CreditCard
} from 'lucide-react';
import { clientesApi, dgiiApi, Cliente } from '../../imports/api';

const TIPOS_NCF = [
  { codigo: 'B01', nombre: 'Crédito Fiscal' },
  { codigo: 'B02', nombre: 'Consumidor Final' },
  { codigo: 'B14', nombre: 'Régimen Especial' },
  { codigo: 'B15', nombre: 'Gubernamental' },
];

const NCF_BADGE: Record<string, string> = {
  B01: 'bg-blue-100 text-blue-700 border-blue-200',
  B02: 'bg-green-100 text-green-700 border-green-200',
  B14: 'bg-purple-100 text-purple-700 border-purple-200',
  B15: 'bg-orange-100 text-orange-700 border-orange-200',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(v);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ── Formulario vacío ─────────────────────────────────────
const EMPTY_FORM = {
  nombreCompleto: '',
  rncCedula: '',
  telefono: '',
  email: '',
  direccion: '',
  tipoNcfPreferido: 'B02',
  descuentoPredeterminado: 0,
  estado: 'ACTIVO',
  diasCredito: 0,
  montoLimiteCredito: 0,
};

type FormData = typeof EMPTY_FORM;

// Badges de estado de crédito
const CREDITO_BADGE: Record<string, { label: string; cls: string }> = {
  SIN_CREDITO: { label: 'Sin Crédito', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  AL_DIA:      { label: 'Al Día',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  BLOQUEADO:   { label: 'Bloqueado', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// ── Modal de creación / edición ──────────────────────────
function ClienteModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = cliente !== null;
  const [form, setForm] = useState<FormData>(
    isEdit
      ? {
          nombreCompleto: cliente.nombreCompleto,
          rncCedula: cliente.rncCedula ?? '',
          telefono: cliente.telefono ?? '',
          email: cliente.email ?? '',
          direccion: cliente.direccion ?? '',
          tipoNcfPreferido: cliente.tipoNcfPreferido,
          descuentoPredeterminado: cliente.descuentoPredeterminado,
          estado: cliente.estado,
          diasCredito: cliente.diasCredito ?? 0,
          montoLimiteCredito: cliente.montoLimiteCredito ?? 0,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [consultandoDgii, setConsultandoDgii] = useState(false);
  const [mensajeDgii, setMensajeDgii] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const set = (field: keyof FormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleConsultarDgii = async (rncOverride?: string) => {
    const rncToQuery = (rncOverride ?? form.rncCedula).replace(/[^0-9]/g, '');
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
        setForm(prev => ({
          ...prev,
          nombreCompleto: nombreEncontrado,
          rncCedula: res.cedulaRnc || prev.rncCedula,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Validación frontend: B01 requiere RNC
    if (form.tipoNcfPreferido === 'B01' && !form.rncCedula.trim()) {
      setError('El RNC/Cédula es obligatorio para Crédito Fiscal (B01).');
      return;
    }
    setSaving(true);
    try {
      const body = {
        nombreCompleto: form.nombreCompleto,
        rncCedula: form.rncCedula || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        direccion: form.direccion || undefined,
        tipoNcfPreferido: form.tipoNcfPreferido,
        descuentoPredeterminado: form.descuentoPredeterminado,
        estado: form.estado,
        diasCredito: form.diasCredito,
        montoLimiteCredito: form.montoLimiteCredito,
      };
      if (isEdit) {
        await clientesApi.actualizar(cliente.idCliente, body);
      } else {
        await clientesApi.crear(body);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente.');
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
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold">
              {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* RNC / Cédula con consulta DGII (PRIMERO) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide">
                RNC / Cédula
                {form.tipoNcfPreferido === 'B01' && (
                  <span className="text-destructive ml-1">* (requerido para B01)</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => handleConsultarDgii()}
                disabled={consultandoDgii || !form.rncCedula.trim()}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
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
              value={form.rncCedula}
              onChange={(e) => {
                set('rncCedula', e.target.value);
                setMensajeDgii(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConsultarDgii();
                }
              }}
              onBlur={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                if ((clean.length === 9 || clean.length === 11) && !form.nombreCompleto.trim()) {
                  handleConsultarDgii(clean);
                }
              }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Ej. 131996035 o 001-0000000-0"
              autoFocus={!isEdit}
            />
            {mensajeDgii && (
              <p className={`text-xs font-medium mt-1 ${mensajeDgii.tipo === 'exito' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {mensajeDgii.texto}
              </p>
            )}
          </div>

          {/* Nombre completo (SEGUNDO - Auto-completado por DGII) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
              Nombre completo / Razón Social <span className="text-destructive">*</span>
            </label>
            <input
              required
              value={form.nombreCompleto}
              onChange={(e) => set('nombreCompleto', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Se auto-completa al consultar DGII o ingrese manualmente"
            />
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="809-000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) => set('direccion', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Calle, No., Sector, Ciudad"
            />
          </div>

          {/* NCF Preferido + Descuento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                NCF Preferido
              </label>
              <select
                value={form.tipoNcfPreferido}
                onChange={(e) => set('tipoNcfPreferido', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {TIPOS_NCF.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.codigo} — {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                Descuento Predeterminado %
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.descuentoPredeterminado}
                  onChange={(e) => set('descuentoPredeterminado', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 pr-8 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none text-right"
                />
                <Percent size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Estado (solo edición) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => set('estado', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </div>
          )}

          {/* Configuración de Crédito */}
          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide">Configuración de Crédito</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Ambos campos deben ser mayores que 0 para activar el crédito. Dejar en 0 = sin crédito.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Días de plazo</label>
                <input
                  id="input-dias-credito"
                  type="number" min="0" step="1"
                  value={form.diasCredito}
                  onChange={(e) => set('diasCredito', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none text-right"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Límite de crédito (DOP)</label>
                <input
                  id="input-monto-credito"
                  type="number" min="0" step="100"
                  value={form.montoLimiteCredito}
                  onChange={(e) => set('montoLimiteCredito', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none text-right"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const PAGE_SIZE = 15;

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await clientesApi.listar(page, PAGE_SIZE);
      setClientes(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const filteredClientes = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.nombreCompleto.toLowerCase().includes(q) ||
      (c.rncCedula ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const handleToggleEstado = async (c: Cliente) => {
    if (c.idCliente === 1) return; // Consumidor Final protegido
    setActionLoading(c.idCliente);
    try {
      if (c.estado === 'ACTIVO') {
        await clientesApi.desactivar(c.idCliente);
      } else {
        await clientesApi.actualizar(c.idCliente, { estado: 'ACTIVO' });
      }
      fetchClientes();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (c: Cliente) => {
    if (c.idCliente === 1) return; // Consumidor Final protegido
    setEditingCliente(c);
    setShowModal(true);
  };

  const handleNewCliente = () => {
    setEditingCliente(null);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingCliente(null);
    fetchClientes();
  };

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users size={22} className="text-blue-500" />
            Gestión de Clientes
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalElements} cliente{totalElements !== 1 ? 's' : ''} registrado{totalElements !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="btn-nuevo-cliente"
          onClick={handleNewCliente}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RNC o email…"
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">NCF Pref.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Descuento</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Crédito</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Total Compras</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Cargando clientes…
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                filteredClientes.map((c) => {
                  const isGenerico = c.idCliente === 1;
                  const isToggling = actionLoading === c.idCliente;
                  return (
                    <tr
                      key={c.idCliente}
                      className={`border-b border-border/60 transition-colors hover:bg-muted/20 ${
                        c.estado === 'INACTIVO' ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                            {c.nombreCompleto.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px]">{c.nombreCompleto}</p>
                            {c.rncCedula && (
                              <p className="text-xs text-muted-foreground font-mono">{c.rncCedula}</p>
                            )}
                            {isGenerico && (
                              <span className="text-xs text-amber-600 font-medium">Genérico (sistema)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {c.telefono && (
                            <p className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Phone size={11} /> {c.telefono}
                            </p>
                          )}
                          {c.email && (
                            <p className="text-xs flex items-center gap-1 text-muted-foreground truncate max-w-[160px]">
                              <Mail size={11} /> {c.email}
                            </p>
                          )}
                          {c.direccion && (
                            <p className="text-xs flex items-center gap-1 text-muted-foreground truncate max-w-[160px]">
                              <MapPin size={11} /> {c.direccion}
                            </p>
                          )}
                          {!c.telefono && !c.email && !c.direccion && (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>

                      {/* NCF */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${NCF_BADGE[c.tipoNcfPreferido] ?? 'bg-muted text-foreground border-border'}`}>
                          <FileText size={10} />
                          {c.tipoNcfPreferido}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TIPOS_NCF.find((t) => t.codigo === c.tipoNcfPreferido)?.nombre ?? c.tipoNcfPreferido}
                        </p>
                      </td>

                      {/* Descuento */}
                      <td className="px-4 py-3 text-center">
                        {c.descuentoPredeterminado > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <Percent size={10} />
                            {c.descuentoPredeterminado.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Crédito */}
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const badge = CREDITO_BADGE[c.estadoCredito] ?? CREDITO_BADGE['SIN_CREDITO'];
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}>
                              <CreditCard size={10} />
                              {badge.label}
                            </span>
                          );
                        })()}
                        {c.estadoCredito !== 'SIN_CREDITO' && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatCurrency(c.montoLimiteCredito)} / {c.diasCredito}d
                          </p>
                        )}
                      </td>

                      {/* Total compras */}
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1 text-sm font-semibold text-blue-600">
                          <TrendingUp size={13} />
                          {formatCurrency(c.totalCompras)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Desde {formatDate(c.fechaCreacion)}
                        </p>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          c.estado === 'ACTIVO'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {c.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`btn-editar-cliente-${c.idCliente}`}
                            onClick={() => handleEdit(c)}
                            disabled={isGenerico}
                            title={isGenerico ? 'No editable' : 'Editar cliente'}
                            className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            id={`btn-toggle-cliente-${c.idCliente}`}
                            onClick={() => handleToggleEstado(c)}
                            disabled={isGenerico || isToggling}
                            title={isGenerico ? 'No modificable' : c.estado === 'ACTIVO' ? 'Desactivar cliente' : 'Activar cliente'}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              c.estado === 'ACTIVO'
                                ? 'hover:bg-red-100 hover:text-red-700'
                                : 'hover:bg-green-100 hover:text-green-700'
                            }`}
                          >
                            {isToggling
                              ? <Loader2 size={14} className="animate-spin" />
                              : c.estado === 'ACTIVO'
                                ? <UserX size={14} />
                                : <UserCheck size={14} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ClienteModal
          cliente={editingCliente}
          onClose={() => { setShowModal(false); setEditingCliente(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
