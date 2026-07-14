import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CalendarDays,
  DollarSign,
  Hash,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  TicketPercent,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import {
  categoriasApi,
  cuponesApi,
  type Categoria,
  type Cupon,
  type CuponPayload,
  type TipoDescuentoCupon,
} from '../../imports/api';

// ─── Tipos locales ────────────────────────────────────────────────────────

interface CuponForm {
  codigoSecreto: string;
  tipoDescuento: TipoDescuentoCupon;
  valorDescuento: string;
  aplicaTodasCategorias: boolean;
  categoriaIds: number[];
  montoMinimoCompra: string;
  fechaInicio: string;
  fechaFin: string;
  limiteUsos: string;
  estado: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: CuponForm = {
  codigoSecreto: '',
  tipoDescuento: 'PORCENTAJE',
  valorDescuento: '10',
  aplicaTodasCategorias: true,
  categoriaIds: [],
  montoMinimoCompra: '0',
  fechaInicio: today(),
  fechaFin: '',
  limiteUsos: '100',
  estado: 'ACTIVO',
};

const PAGE_SIZE = 20;

// ─── Helpers de formato ──────────────────────────────────────────────────

const fmtDate = (date: string | null) => {
  if (!date) return 'Sin fin';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const fmtDescuento = (cupon: Cupon) =>
  cupon.tipoDescuento === 'PORCENTAJE'
    ? `${Number(cupon.valorDescuento).toFixed(0)}%`
    : `RD$ ${Number(cupon.valorDescuento).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const estadoConfig = (cupon: Cupon): { label: string; cls: string } => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (cupon.estado === 'INACTIVO') return { label: 'Inactivo', cls: 'bg-slate-100 text-slate-600' };
  if (cupon.fechaFin) {
    const fin = new Date(cupon.fechaFin + 'T00:00:00');
    if (fin < hoy) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' };
  }
  if (cupon.usosActuales >= cupon.limiteUsos) return { label: 'Agotado', cls: 'bg-orange-100 text-orange-700' };
  return { label: 'Activo', cls: 'bg-emerald-100 text-emerald-700' };
};

// ─── Componente principal ────────────────────────────────────────────────

export default function Cupones() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cupon | null>(null);
  const [form, setForm] = useState<CuponForm>(EMPTY_FORM);

  // ── Carga de datos ────────────────────────────────────────────────────

  const cargar = useCallback(async (p = 0) => {
    setLoading(true);
    setError(null);
    try {
      const [res, cats] = await Promise.all([
        cuponesApi.listar(p, PAGE_SIZE),
        categorias.length === 0 ? categoriasApi.listarActivas() : Promise.resolve(null),
      ]);
      setCupones(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
      if (cats) setCategorias(cats.content);
    } catch (e: any) {
      setError(e.message || 'Error al cargar cupones.');
    } finally {
      setLoading(false);
    }
  }, [categorias.length]);

  useEffect(() => { cargar(0); }, []);

  // ── Filtro local ──────────────────────────────────────────────────────

  const cuponesVisible = useMemo(() => {
    const q = search.toLowerCase();
    return cupones.filter(c => {
      const matchSearch =
        c.codigoInterno.toLowerCase().includes(q) ||
        c.codigoSecreto.toLowerCase().includes(q);
      const matchEstado = filtroEstado === 'TODOS' || c.estado === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [cupones, search, filtroEstado]);

  // ── Modal helpers ─────────────────────────────────────────────────────

  const abrirCrear = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const abrirEditar = (c: Cupon) => {
    setEditando(c);
    setForm({
      codigoSecreto: c.codigoSecreto,
      tipoDescuento: c.tipoDescuento,
      valorDescuento: String(c.valorDescuento),
      aplicaTodasCategorias: c.aplicaTodasCategorias,
      categoriaIds: c.categorias.map(cat => cat.idCategoria),
      montoMinimoCompra: String(c.montoMinimoCompra),
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin ?? '',
      limiteUsos: String(c.limiteUsos),
      estado: c.estado,
    });
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setForm(EMPTY_FORM);
  };

  const toggleCategoria = (id: number) => {
    setForm(f => ({
      ...f,
      categoriaIds: f.categoriaIds.includes(id)
        ? f.categoriaIds.filter(i => i !== id)
        : [...f.categoriaIds, id],
    }));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const payload: CuponPayload = {
        codigoSecreto: form.codigoSecreto.toUpperCase(),
        tipoDescuento: form.tipoDescuento,
        valorDescuento: Number(form.valorDescuento),
        aplicaTodasCategorias: form.aplicaTodasCategorias,
        categoriaIds: form.aplicaTodasCategorias ? [] : form.categoriaIds,
        montoMinimoCompra: Number(form.montoMinimoCompra),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin || null,
        limiteUsos: Number(form.limiteUsos),
        estado: form.estado,
      };
      if (editando) {
        const updated = await cuponesApi.actualizar(editando.idCupon, payload);
        setCupones(prev => prev.map(c => c.idCupon === updated.idCupon ? updated : c));
      } else {
        const created = await cuponesApi.crear(payload);
        setCupones(prev => [created, ...prev]);
        setTotalElements(n => n + 1);
      }
      cerrarModal();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el cupón.');
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (c: Cupon) => {
    if (!confirm(`¿Desactivar el cupón ${c.codigoInterno}?`)) return;
    try {
      await cuponesApi.desactivar(c.idCupon);
      setCupones(prev => prev.map(x => x.idCupon === c.idCupon ? { ...x, estado: 'INACTIVO' } : x));
    } catch (e: any) {
      alert(e.message || 'Error al desactivar.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4
                      bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TicketPercent className="w-7 h-7 text-violet-600" />
            Gestión de Cupones
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalElements} cupones registrados
          </p>
        </div>
        <button
          id="btn-nuevo-cupon"
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white
                     px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-violet-200"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cupón
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código interno o código secreto…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as any)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none
                     focus:ring-2 focus:ring-violet-400"
        >
          <option value="TODOS">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center items-center h-52">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-52 text-red-500 gap-2">
          <p className="text-sm">{error}</p>
          <button onClick={() => cargar(page)} className="text-xs underline">Reintentar</button>
        </div>
      ) : cuponesVisible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 text-slate-400 gap-2">
          <TicketPercent className="w-12 h-12 opacity-25" />
          <p className="text-sm">No hay cupones que mostrar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Código Interno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Código Secreto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descuento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mín. Compra</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vigencia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Categorías</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cuponesVisible.map((c) => {
                  const est = estadoConfig(c);
                  const usoPct = Math.min((c.usosActuales / c.limiteUsos) * 100, 100);
                  return (
                    <tr key={c.idCupon} className="hover:bg-slate-50/60 transition-colors">
                      {/* Código interno */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {c.codigoInterno}
                        </span>
                      </td>
                      {/* Código secreto */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded text-xs tracking-wider">
                          {c.codigoSecreto}
                        </span>
                      </td>
                      {/* Descuento */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.tipoDescuento === 'PORCENTAJE'
                            ? <BadgePercent className="w-4 h-4 text-violet-500" />
                            : <DollarSign className="w-4 h-4 text-emerald-500" />
                          }
                          <span className="font-semibold text-slate-800">{fmtDescuento(c)}</span>
                        </div>
                      </td>
                      {/* Mínimo compra */}
                      <td className="px-4 py-3 text-slate-600">
                        {c.montoMinimoCompra > 0
                          ? `RD$ ${Number(c.montoMinimoCompra).toLocaleString('es-DO')}`
                          : <span className="text-slate-400 text-xs">Sin mínimo</span>
                        }
                      </td>
                      {/* Vigencia */}
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1 text-xs">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          {fmtDate(c.fechaInicio)} — {fmtDate(c.fechaFin)}
                        </div>
                      </td>
                      {/* Usos */}
                      <td className="px-4 py-3">
                        <div className="space-y-1 min-w-[80px]">
                          <span className="text-xs text-slate-500">{c.usosActuales}/{c.limiteUsos}</span>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${usoPct >= 90 ? 'bg-red-500' : usoPct >= 70 ? 'bg-orange-500' : 'bg-violet-500'}`}
                              style={{ width: `${usoPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Categorías */}
                      <td className="px-4 py-3">
                        {c.aplicaTodasCategorias
                          ? <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Todas</span>
                          : <span className="text-xs text-slate-500">{c.categorias.map(x => x.nombre).join(', ') || '—'}</span>
                        }
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${est.cls}`}>
                          {est.label}
                        </span>
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            id={`btn-editar-cupon-${c.idCupon}`}
                            onClick={() => abrirEditar(c)}
                            title="Editar"
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {c.estado === 'ACTIVO' && (
                            <button
                              id={`btn-desactivar-cupon-${c.idCupon}`}
                              onClick={() => desactivar(c)}
                              title="Desactivar"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => { setPage(p => p - 1); cargar(page - 1); }}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => { setPage(p => p + 1); cargar(page + 1); }}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Slide-over ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={cerrarModal} />

          {/* Panel */}
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Header del panel */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <TicketPercent className="w-5 h-5 text-violet-600" />
                <h2 className="font-semibold text-slate-800">
                  {editando ? `Editar ${editando.codigoInterno}` : 'Nuevo Cupón'}
                </h2>
              </div>
              <button onClick={cerrarModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del formulario */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Código Secreto */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-violet-500" /> Código Secreto
                </label>
                <input
                  value={form.codigoSecreto}
                  onChange={e => setForm(f => ({ ...f, codigoSecreto: e.target.value.toUpperCase() }))}
                  placeholder="NAVIDAD2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono uppercase
                             focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <p className="text-xs text-slate-400">El código que el cajero digitará en el POS.</p>
              </div>

              {/* Tipo de descuento */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-violet-500" /> Tipo de Descuento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PORCENTAJE', 'MONTO_FIJO'] as TipoDescuentoCupon[]).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tipoDescuento: tipo }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        form.tipoDescuento === tipo
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-600 hover:border-violet-300'
                      }`}
                    >
                      {tipo === 'PORCENTAJE' ? <BadgePercent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                      {tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto Fijo (RD$)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor del descuento + mínimo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {form.tipoDescuento === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto Fijo (RD$)'}
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    max={form.tipoDescuento === 'PORCENTAJE' ? 100 : undefined}
                    step={form.tipoDescuento === 'PORCENTAJE' ? 1 : 0.01}
                    value={form.valorDescuento}
                    onChange={e => setForm(f => ({ ...f, valorDescuento: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Mínimo de Compra (RD$)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.montoMinimoCompra}
                    onChange={e => setForm(f => ({ ...f, montoMinimoCompra: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              {/* Vigencia */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-violet-500" /> Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Fecha Fin (opcional)</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              {/* Límite de usos */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Límite de Usos</label>
                <input
                  type="number"
                  min={1}
                  value={form.limiteUsos}
                  onChange={e => setForm(f => ({ ...f, limiteUsos: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* Categorías */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-500" /> Compatibilidad de Categorías
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, aplicaTodasCategorias: !f.aplicaTodasCategorias, categoriaIds: [] }))}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    {form.aplicaTodasCategorias
                      ? <><ToggleRight className="w-5 h-5 text-violet-600" /><span className="text-violet-700 font-medium">Todas las categorías</span></>
                      : <><ToggleLeft className="w-5 h-5 text-slate-400" /><span className="text-slate-500">Categorías específicas</span></>
                    }
                  </button>
                </div>

                {!form.aplicaTodasCategorias && (
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-3">
                    {categorias.map(cat => (
                      <label
                        key={cat.idCategoria}
                        className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm transition-all ${
                          form.categoriaIds.includes(cat.idCategoria)
                            ? 'border-violet-400 bg-violet-50 text-violet-700'
                            : 'border-slate-200 text-slate-600 hover:border-violet-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-violet-600"
                          checked={form.categoriaIds.includes(cat.idCategoria)}
                          onChange={() => toggleCategoria(cat.idCategoria)}
                        />
                        {cat.nombre}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Estado */}
              {editando && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                           border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-guardar-cupon"
                onClick={guardar}
                disabled={saving || !form.codigoSecreto || !form.valorDescuento || !form.fechaInicio}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                           bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? 'Actualizar Cupón' : 'Crear Cupón'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
