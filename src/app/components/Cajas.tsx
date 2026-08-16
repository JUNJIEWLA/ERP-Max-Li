import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { almacenesApi, cajasApi, type Almacen, type Caja } from '../../imports/api';

interface CajaForm {
  nombre: string;
  estado: 'ACTIVO' | 'INACTIVO';
  idAlmacen: number | null;
}

const EMPTY_FORM: CajaForm = {
  nombre: '',
  estado: 'ACTIVO',
  idAlmacen: null,
};

const PAGE_SIZE = 10;

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

export default function Cajas() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Caja | null>(null);
  const [form, setForm] = useState<CajaForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Caja | null>(null);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

  useEffect(() => {
    almacenesApi.listar(0, 100)
      .then((data) => setAlmacenes(data.content.filter((almacen) => almacen.estado === 'ACTIVO')))
      .catch(() => setAlmacenes([]));
  }, []);

  const cargarCajas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cajasApi.listar(page, PAGE_SIZE);
      setCajas(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err: any) {
      setError(err.message || 'Error al cargar cajas registradoras');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { cargarCajas(); }, [cargarCajas]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (caja: Caja) => {
    setEditTarget(caja);
    setForm({
      nombre: caja.nombre,
      estado: caja.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      idAlmacen: caja.idAlmacen,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
    setFormError('');
    setSaving(false);
  };

  const validate = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio';
    if (form.nombre.trim().length > 100) return 'El nombre no puede superar 100 caracteres';
    if (!form.idAlmacen) return 'El almacén es obligatorio: las ventas de esta caja descontarán de ese almacén';
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const body = {
        nombre: form.nombre.trim(),
        estado: form.estado,
        idAlmacen: form.idAlmacen as number,
      };

      if (editTarget) {
        await cajasApi.actualizar(editTarget.idCaja, body);
      } else {
        await cajasApi.crear(body);
      }

      closeModal();
      await cargarCajas();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar la caja');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!confirmTarget) return;

    try {
      if (confirmTarget.estado === 'ACTIVO') {
        await cajasApi.desactivar(confirmTarget.idCaja);
      } else {
        await cajasApi.actualizar(confirmTarget.idCaja, {
          nombre: confirmTarget.nombre,
          estado: 'ACTIVO',
          idAlmacen: confirmTarget.idAlmacen as number,
        });
      }
      setConfirmTarget(null);
      await cargarCajas();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado de caja');
      setConfirmTarget(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cajas;
    return cajas.filter((caja) =>
      caja.nombre.toLowerCase().includes(q) ||
      String(caja.idCaja).includes(q) ||
      caja.estado.toLowerCase().includes(q)
    );
  }, [cajas, search]);

  const activas = cajas.filter((caja) => caja.estado === 'ACTIVO').length;
  const inactivas = cajas.filter((caja) => caja.estado === 'INACTIVO').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Monitor size={26} className="text-primary" />
            Cajas Registradoras
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las cajas físicas disponibles para apertura de turnos.
          </p>
        </div>
        <button
          id="btn-nueva-caja-registradora"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus size={18} />
          Nueva Caja
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total registradas', value: totalElements, cls: 'text-primary', icon: Monitor },
          { label: 'Activas en página', value: activas, cls: 'text-emerald-600', icon: ToggleRight },
          { label: 'Inactivas en página', value: inactivas, cls: 'text-rose-600', icon: ToggleLeft },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <Icon size={17} className={stat.cls} />
              </div>
              <p className={`text-2xl font-bold mt-1 ${stat.cls}`}>{loading ? '-' : stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, ID o estado..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No se encontraron cajas registradoras</p>
            {search && <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">ID</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Nombre</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Almacén</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Creación</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Última modificación</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((caja) => (
                <tr key={caja.idCaja} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">
                      CAJA-{String(caja.idCaja).padStart(3, '0')}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{caja.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{caja.almacenNombre ?? 'Sin asignar'}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={14} />
                      {formatDateTime(caja.fechaCreacion)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDateTime(caja.fechaModificacion)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      caja.estado === 'ACTIVO'
                        ? 'bg-green-500/15 text-green-600'
                        : 'bg-rose-500/15 text-rose-600'
                    }`}>
                      {caja.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        id={`btn-editar-caja-${caja.idCaja}`}
                        onClick={() => openEdit(caja)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        id={`btn-toggle-caja-${caja.idCaja}`}
                        onClick={() => setConfirmTarget(caja)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          caja.estado === 'ACTIVO'
                            ? 'hover:bg-rose-500/10 text-rose-500'
                            : 'hover:bg-green-500/10 text-green-500'
                        }`}
                        title={caja.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                      >
                        {caja.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <Monitor size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">
                  {editTarget ? 'Editar Caja Registradora' : 'Nueva Caja Registradora'}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Nombre <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-caja-nombre"
                  value={form.nombre}
                  onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Ej: Caja Principal"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Almacén <span className="text-rose-500">*</span>
                </label>
                <select
                  id="input-caja-almacen"
                  value={form.idAlmacen ?? ''}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    idAlmacen: event.target.value ? Number(event.target.value) : null,
                  }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Seleccione un almacén...</option>
                  {almacenes.map((almacen) => (
                    <option key={almacen.idAlmacen} value={almacen.idAlmacen}>{almacen.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Las ventas cobradas en esta caja descontarán existencia únicamente de este almacén.
                </p>
              </div>

              {editTarget && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Estado</label>
                  <select
                    id="input-caja-estado"
                    value={form.estado}
                    onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value as CajaForm['estado'] }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                id="btn-guardar-caja"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : editTarget ? 'Actualizar' : 'Crear Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Monitor size={18} className={confirmTarget.estado === 'ACTIVO' ? 'text-rose-500' : 'text-green-500'} />
              <h3 className="text-lg font-bold text-foreground">
                {confirmTarget.estado === 'ACTIVO' ? '¿Desactivar caja?' : '¿Activar caja?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmTarget.estado === 'ACTIVO'
                ? 'La caja quedará inactiva y no debería usarse para abrir nuevos turnos.'
                : 'La caja volverá a estar disponible para operación.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-toggle-caja"
                onClick={handleToggle}
                className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
                  confirmTarget.estado === 'ACTIVO'
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {confirmTarget.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
