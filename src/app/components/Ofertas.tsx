import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CalendarDays,
  Gift,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import {
  ofertasApi,
  productosApi,
  type Oferta,
  type OfertaPayload,
  type OfertaTipo,
  type Producto,
} from '../../imports/api';

interface OfertaForm {
  nombre: string;
  descripcion: string;
  tipo: OfertaTipo;
  idProducto: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  cantidadRequerida: string;
  cantidadPagada: string;
  porcentajeDescuento: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: OfertaForm = {
  nombre: '',
  descripcion: '',
  tipo: 'CANTIDAD',
  idProducto: '',
  fechaInicio: today(),
  fechaFin: '',
  estado: 'ACTIVO',
  cantidadRequerida: '3',
  cantidadPagada: '2',
  porcentajeDescuento: '15',
};

const PAGE_SIZE = 20;

const fmtDate = (date: string | null) => {
  if (!date) return 'Sin fin';
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const tipoLabel = (oferta: Oferta) => {
  if (oferta.tipo === 'CANTIDAD') {
    return `Compra ${oferta.cantidadRequerida}, paga ${oferta.cantidadPagada}`;
  }
  return `${Number(oferta.porcentajeDescuento ?? 0).toFixed(2)}% descuento`;
};

export default function Ofertas() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'TODAS' | OfertaTipo>('TODAS');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Oferta | null>(null);
  const [form, setForm] = useState<OfertaForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageOfertas, pageProductos] = await Promise.all([
        tipoFiltro === 'TODAS'
          ? ofertasApi.listar(page, PAGE_SIZE)
          : ofertasApi.listarPorTipo(tipoFiltro, page, PAGE_SIZE),
        productosApi.listarActivos(0, 200),
      ]);
      setOfertas(pageOfertas.content);
      setTotalPages(pageOfertas.totalPages);
      setTotalElements(pageOfertas.totalElements);
      setProductos(pageProductos.content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar ofertas');
    } finally {
      setLoading(false);
    }
  }, [page, tipoFiltro]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (oferta: Oferta) => {
    setEditTarget(oferta);
    setForm({
      nombre: oferta.nombre,
      descripcion: oferta.descripcion ?? '',
      tipo: oferta.tipo,
      idProducto: String(oferta.idProducto),
      fechaInicio: oferta.fechaInicio,
      fechaFin: oferta.fechaFin ?? '',
      estado: oferta.estado,
      cantidadRequerida: String(oferta.cantidadRequerida ?? 3),
      cantidadPagada: String(oferta.cantidadPagada ?? 2),
      porcentajeDescuento: String(oferta.porcentajeDescuento ?? 15),
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
  };

  const validate = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio';
    if (!form.idProducto) return 'Selecciona un producto';
    if (!form.fechaInicio) return 'La fecha de inicio es obligatoria';
    if (form.fechaFin && form.fechaFin < form.fechaInicio) return 'La fecha fin no puede ser anterior a la fecha inicio';

    if (form.tipo === 'CANTIDAD') {
      const requerida = Number(form.cantidadRequerida);
      const pagada = Number(form.cantidadPagada);
      if (!Number.isInteger(requerida) || requerida < 2) return 'La cantidad requerida debe ser un entero mayor que 1';
      if (!Number.isInteger(pagada) || pagada < 1) return 'La cantidad pagada debe ser un entero mayor que 0';
      if (pagada >= requerida) return 'La cantidad pagada debe ser menor que la cantidad requerida';
      return null;
    }

    const descuento = Number(form.porcentajeDescuento);
    if (Number.isNaN(descuento) || descuento <= 0 || descuento > 100) {
      return 'El porcentaje debe ser mayor que 0 y menor o igual a 100';
    }
    return null;
  };

  const buildPayload = (): OfertaPayload => ({
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim() || null,
    tipo: form.tipo,
    idProducto: Number(form.idProducto),
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin || null,
    estado: form.estado,
    cantidadRequerida: form.tipo === 'CANTIDAD' ? Number(form.cantidadRequerida) : null,
    cantidadPagada: form.tipo === 'CANTIDAD' ? Number(form.cantidadPagada) : null,
    porcentajeDescuento: form.tipo === 'DESCUENTO' ? Number(form.porcentajeDescuento) : null,
  });

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = buildPayload();
      if (editTarget) {
        await ofertasApi.actualizar(editTarget.idOferta, payload);
      } else {
        await ofertasApi.crear(payload);
      }
      closeModal();
      cargarDatos();
    } catch (e: any) {
      setFormError(e.message || 'Error al guardar la oferta');
    } finally {
      setSaving(false);
    }
  };

  const handleDesactivar = async (id: number) => {
    try {
      await ofertasApi.desactivar(id);
      cargarDatos();
    } catch (e: any) {
      alert(e.message || 'Error al desactivar oferta');
    } finally {
      setConfirmId(null);
    }
  };

  const ofertasFiltradas = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ofertas;
    return ofertas.filter((oferta) =>
      oferta.nombre.toLowerCase().includes(q) ||
      oferta.productoNombre.toLowerCase().includes(q) ||
      oferta.productoSku.toLowerCase().includes(q)
    );
  }, [ofertas, search]);

  const activas = ofertas.filter((o) => o.estado === 'ACTIVO').length;
  const vigentes = ofertas.filter((o) => o.vigente).length;
  const cantidad = ofertas.filter((o) => o.tipo === 'CANTIDAD').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BadgePercent size={26} className="text-primary" /> Ofertas y Promociones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona descuentos por cantidad y promociones temporales por producto.
          </p>
        </div>
        <button
          id="btn-nueva-oferta"
          onClick={openCreate}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity font-medium"
        >
          <Plus size={18} /> Nueva Oferta
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total ofertas', value: totalElements, cls: 'text-primary', icon: Tag },
          { label: 'Activas', value: activas, cls: 'text-emerald-600', icon: ToggleRight },
          { label: 'Vigentes', value: vigentes, cls: 'text-cyan-600', icon: CalendarDays },
          { label: 'Por cantidad', value: cantidad, cls: 'text-amber-600', icon: Gift },
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
            placeholder="Buscar por oferta, SKU o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
        <select
          value={tipoFiltro}
          onChange={(e) => {
            setPage(0);
            setTipoFiltro(e.target.value as 'TODAS' | OfertaTipo);
          }}
          className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="TODAS">Todos los tipos</option>
          <option value="CANTIDAD">Por cantidad</option>
          <option value="DESCUENTO">Descuento %</option>
        </select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : ofertasFiltradas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BadgePercent size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No se encontraron ofertas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Oferta</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Producto</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Regla</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Vigencia</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ofertasFiltradas.map((oferta) => (
                <tr key={oferta.idOferta} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{oferta.nombre}</p>
                    <p className="text-xs text-muted-foreground">{oferta.descripcion || 'Sin descripcion'}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{oferta.productoNombre}</p>
                    <p className="text-xs font-mono text-muted-foreground">{oferta.productoSku}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      oferta.tipo === 'CANTIDAD'
                        ? 'bg-amber-500/15 text-amber-700'
                        : 'bg-cyan-500/15 text-cyan-700'
                    }`}>
                      {oferta.tipo === 'CANTIDAD' ? <Gift size={12} /> : <BadgePercent size={12} />}
                      {tipoLabel(oferta)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} />
                      <span>{fmtDate(oferta.fechaInicio)} - {fmtDate(oferta.fechaFin)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        oferta.estado === 'ACTIVO'
                          ? 'bg-green-500/15 text-green-600'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}>
                        {oferta.estado}
                      </span>
                      {oferta.vigente && (
                        <span className="text-[11px] text-cyan-600 font-medium">Vigente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(oferta)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmId(oferta.idOferta)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          oferta.estado === 'ACTIVO'
                            ? 'hover:bg-rose-500/10 text-rose-500'
                            : 'hover:bg-green-500/10 text-green-500'
                        }`}
                        title={oferta.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                      >
                        {oferta.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <BadgePercent size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">
                  {editTarget ? 'Editar Oferta' : 'Nueva Oferta'}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Ej: 3x2 en galletas"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Producto <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.idProducto}
                    onChange={(e) => setForm((f) => ({ ...f, idProducto: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Selecciona un producto</option>
                    {productos.map((p) => (
                      <option key={p.idProducto} value={p.idProducto}>
                        {p.sku} - {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Notas internas de la promoción..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as OfertaTipo }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="CANTIDAD">Por cantidad</option>
                    <option value="DESCUENTO">Descuento %</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Fecha fin</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {form.tipo === 'CANTIDAD' ? (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                      Cantidad requerida
                    </label>
                    <input
                      type="number"
                      min="2"
                      step="1"
                      value={form.cantidadRequerida}
                      onChange={(e) => setForm((f) => ({ ...f, cantidadRequerida: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                      Cantidad pagada
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.cantidadPagada}
                      onChange={(e) => setForm((f) => ({ ...f, cantidadPagada: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-right"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Gift size={14} />
                    Ejemplo: para “lleva 3 y paga 2”, usa requerida 3 y pagada 2.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Porcentaje de descuento
                  </label>
                  <div className="relative max-w-xs">
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={form.porcentajeDescuento}
                      onChange={(e) => setForm((f) => ({ ...f, porcentajeDescuento: e.target.value }))}
                      className="w-full px-3 py-2 pr-9 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-right"
                    />
                    <BadgePercent size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              )}

              {editTarget && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                    className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
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
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                id="btn-guardar-oferta"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : editTarget ? 'Actualizar' : 'Crear Oferta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-rose-500" />
              <h3 className="text-lg font-bold text-foreground">¿Desactivar oferta?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              La oferta quedará en estado <strong>INACTIVO</strong> y dejará de aparecer como vigente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-desactivar-oferta"
                onClick={() => handleDesactivar(confirmId)}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
