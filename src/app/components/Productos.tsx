import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, Package, RefreshCw,
  X, Loader2, AlertTriangle, Filter, History, TrendingUp, TrendingDown
} from 'lucide-react';
import {
  productosApi, categoriasApi, marcasApi, historialCostosApi,
  type Producto, type Categoria, type Marca, type HistorialCosto
} from '../../imports/api';

interface ProductoForm {
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  precioVenta: string;
  costo: string;
  idCategoria: string;
  idMarca: string;
  estado: string;
  tasaItbis: string;
  cantidadMinimaMayor: string;
  stockMinimo: string;
}

const EMPTY_FORM: ProductoForm = {
  codigoBarras: '', nombre: '', descripcion: '',
  precioVenta: '', costo: '',
  idCategoria: '', idMarca: '', estado: 'ACTIVO',
  tasaItbis: '18.00', cantidadMinimaMayor: '1', stockMinimo: '5',
};

const fmt = (v: number) =>
  `RD$ ${Number(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [totalElementos, setTotalElementos] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 20;

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Producto | null>(null);
  const [form, setForm] = useState<ProductoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Historial Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Producto | null>(null);
  const [historialCostos, setHistorialCostos] = useState<HistorialCosto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openHistory = async (p: Producto) => {
    setHistoryTarget(p);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await historialCostosApi.listarPorProducto(p.idProducto, 0, 50);
      setHistorialCostos(res.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageProductos, pageCategorias, pageMarcas] = await Promise.all([
        productosApi.listar(page, PAGE_SIZE),
        categoriasApi.listarActivas(),
        marcasApi.listarActivas(),
      ]);
      setProductos(pageProductos.content);
      setTotalElementos(pageProductos.totalElements);
      setTotalPages(pageProductos.totalPages);
      setCategorias(pageCategorias.content);
      setMarcas(pageMarcas.content);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (p: Producto) => {
    setEditTarget(p);
    setForm({
      codigoBarras: p.codigoBarras ?? '',
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precioVenta: String(p.precioVenta),
      costo: String(p.costo),
      idCategoria: String(p.idCategoria),
      idMarca: String(p.idMarca),
      estado: p.estado,
      tasaItbis: String(p.tasaItbis ?? 18),
      cantidadMinimaMayor: String(p.cantidadMinimaMayor ?? 1),
      stockMinimo: String(p.stockMinimo ?? 5),
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const validate = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio';
    if (!form.precioVenta || isNaN(Number(form.precioVenta)) || Number(form.precioVenta) < 0)
      return 'El precio de venta debe ser un número válido ≥ 0';
    if (!form.costo || isNaN(Number(form.costo)) || Number(form.costo) < 0)
      return 'El costo debe ser un número válido ≥ 0';
    if (!form.idCategoria) return 'Selecciona una categoría';
    if (!form.idMarca) return 'Selecciona una marca';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    setSaving(true); setFormError('');
    const payload = {
      codigoBarras: form.codigoBarras.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion,
      precioVenta: Number(form.precioVenta),
      costo: Number(form.costo),
      idCategoria: Number(form.idCategoria),
      idMarca: Number(form.idMarca),
      estado: form.estado,
      tasaItbis: Number(form.tasaItbis),
      cantidadMinimaMayor: Number(form.cantidadMinimaMayor),
      stockMinimo: Number(form.stockMinimo || 5),
    };
    try {
      if (editTarget) {
        await productosApi.actualizar(editTarget.idProducto, payload);
      } else {
        await productosApi.crear(payload as any);
      }
      closeModal();
      cargarDatos();
    } catch (e: any) {
      setFormError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDesactivar = async (id: number) => {
    try { await productosApi.desactivar(id); cargarDatos(); }
    catch (e: any) { alert(e.message || 'Error al desactivar'); }
    finally { setConfirmId(null); }
  };

  const productosFiltrados = productos.filter(p => {
    const matchSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigoBarras ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoriaFiltro || p.categoriaNombre === categoriaFiltro;
    return matchSearch && matchCat;
  });

  const totalActivos = productos.filter(p => p.estado === 'ACTIVO').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package size={26} className="text-primary" /> Catálogo de Productos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargarDatos}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity">
            <RefreshCw size={18} />
          </button>
          <button id="btn-nuevo-producto" onClick={openCreate}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity font-medium">
            <Plus size={20} /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Productos', value: totalElementos, color: 'bg-primary/10 text-primary' },
          { label: 'Activos', value: totalActivos, color: 'bg-green-500/10 text-green-600' },
          { label: 'Inactivos', value: totalElementos - totalActivos, color: 'bg-rose-500/10 text-rose-600' },
          { label: 'Categorías', value: new Set(productos.map(p => p.categoriaNombre)).size, color: 'bg-violet-500/10 text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color.split(' ')[1]}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nombre o código interno..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.idCategoria} value={c.nombre}>{c.nombre}</option>)}
          </select>
          {categoriaFiltro && (
            <button onClick={() => setCategoriaFiltro('')} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search || categoriaFiltro ? 'No se encontraron productos con ese filtro.' : 'No hay productos registrados aún.'}</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Código interno</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Cód. Barras</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Marca</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Precio Venta</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costo</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productosFiltrados.map(p => (
                  <tr key={p.idProducto} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.codigoBarras || <span className="italic opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.nombre}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-500/10 text-violet-600 font-medium">
                        {p.categoriaNombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.marcaNombre}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(p.precioVenta)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(p.costo)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.estado === 'ACTIVO' ? 'bg-green-500/15 text-green-600' : 'bg-rose-500/15 text-rose-600'}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button id={`btn-history-prod-${p.idProducto}`} onClick={() => openHistory(p)}
                          className="p-1.5 rounded-lg hover:bg-violet-500/10 text-violet-500 transition-colors" title="Historial de Costos">
                          <History size={15} />
                        </button>
                        <button id={`btn-editar-prod-${p.idProducto}`} onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button id={`btn-desactivar-prod-${p.idProducto}`} onClick={() => setConfirmId(p.idProducto)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors" title="Desactivar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Mostrando {productosFiltrados.length} de {totalElementos} productos
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
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

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <h3 className="text-lg font-bold text-foreground">
                {editTarget ? `Editar: ${editTarget.nombre}` : 'Nuevo Producto'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">

              {/* Código interno auto-generado - solo visible al editar */}
              {editTarget && (
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código interno</span>
                  <span className="font-mono text-sm font-bold text-foreground">{editTarget.sku}</span>
                  <span className="text-xs text-muted-foreground ml-auto">(generado automáticamente)</span>
                </div>
              )}

              <div className="grid grid-cols-10 gap-4">
                <div className="col-span-7">
                  <label className="block text-sm font-medium text-foreground mb-1">Código de Barras (EAN/UPC)</label>
                  <input id="input-prod-barcode" type="text" value={form.codigoBarras}
                    onChange={e => setForm(f => ({ ...f, codigoBarras: e.target.value }))}
                    placeholder="Ej: 7501000000000 (opcional)"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <p className="text-xs text-muted-foreground mt-1">Código del fabricante — no necesita ser único</p>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                  <select id="input-prod-estado" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nombre <span className="text-rose-500">*</span></label>
                <input id="input-prod-nombre" type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre del producto"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
                <textarea id="input-prod-descripcion" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción del producto..." rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Categoría <span className="text-rose-500">*</span></label>
                  <select id="input-prod-categoria" value={form.idCategoria}
                    onChange={e => setForm(f => ({ ...f, idCategoria: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Marca <span className="text-rose-500">*</span></label>
                  <select id="input-prod-marca" value={form.idMarca}
                    onChange={e => setForm(f => ({ ...f, idMarca: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="">Seleccionar marca...</option>
                    {marcas.map(m => <option key={m.idMarca} value={m.idMarca}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Costo (RD$) <span className="text-rose-500">*</span></label>
                  <input id="input-prod-costo" type="number" min="0" step="0.01" value={form.costo}
                    onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Precio de Venta (RD$) <span className="text-rose-500">*</span></label>
                  <input id="input-prod-precio" type="number" min="0" step="0.01" value={form.precioVenta}
                    onChange={e => setForm(f => ({ ...f, precioVenta: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  
                  {(() => {
                    if (form.idCategoria && form.costo && Number(form.costo) > 0) {
                      const cat = categorias.find(c => c.idCategoria === Number(form.idCategoria));
                      if (cat && (cat.porcentajeMargen > 0 || (cat.porcentajeMargenMayor ?? 0) > 0)) {
                        const suggestedDetalle = cat.porcentajeMargen > 0
                          ? Number(form.costo) * (1 + cat.porcentajeMargen / 100) : null;
                        const suggestedMayor = (cat.porcentajeMargenMayor ?? 0) > 0
                          ? Number(form.costo) * (1 + cat.porcentajeMargenMayor / 100) : null;
                        return (
                          <div className="mt-2 space-y-1.5">
                            {suggestedDetalle !== null && (
                              <div className="flex items-center justify-between bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
                                <span className="text-xs text-primary font-medium flex items-center gap-1">
                                  💡 Detalle: {fmt(suggestedDetalle)} (Costo + {cat.porcentajeMargen}%)
                                </span>
                                <button type="button" onClick={() => setForm(f => ({ ...f, precioVenta: suggestedDetalle.toFixed(2) }))}
                                  className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors">
                                  Aplicar
                                </button>
                              </div>
                            )}
                            {suggestedMayor !== null && (
                              <div className="flex items-center justify-between bg-violet-500/5 px-3 py-2 rounded-lg border border-violet-500/20">
                                <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                                  💡 Mayor: {fmt(suggestedMayor)} (Costo + {cat.porcentajeMargenMayor}%)
                                </span>
                                <span className="text-[10px] text-violet-500 italic">Se calcula automáticamente</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (cat && cat.porcentajeMargen === 0 && (cat.porcentajeMargenMayor ?? 0) === 0) {
                         return <p className="text-xs text-muted-foreground mt-1 italic">Esta categoría no tiene margen configurado</p>;
                      }
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Campos POS: ITBIS, Cantidad Mínima Mayorista y Stock Mínimo */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tasa ITBIS (%)</label>
                  <select id="input-prod-itbis" value={form.tasaItbis}
                    onChange={e => setForm(f => ({ ...f, tasaItbis: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="18.00">18% (Gravado)</option>
                    <option value="0.00">0% (Exento)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Impuesto ITBIS aplicable</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Mín. Mayorista</label>
                  <input id="input-prod-min-mayor" type="number" min="1" step="1" value={form.cantidadMinimaMayor}
                    onChange={e => setForm(f => ({ ...f, cantidadMinimaMayor: e.target.value }))}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <p className="text-xs text-muted-foreground mt-1">Para precio al por mayor</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Stock Mínimo</label>
                  <input id="input-prod-stock-minimo" type="number" min="0" step="1" value={form.stockMinimo}
                    onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))}
                    placeholder="5"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <p className="text-xs text-muted-foreground mt-1">Nivel para alerta de buzón</p>
                </div>
              </div>

              {form.precioVenta && form.costo && Number(form.precioVenta) > 0 && Number(form.costo) > 0 && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Margen de ganancia estimado</span>
                  <span className={`font-bold ${(Number(form.precioVenta) - Number(form.costo)) >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                    {(((Number(form.precioVenta) - Number(form.costo)) / Number(form.costo)) * 100).toFixed(1)}%
                    &nbsp;({fmt(Number(form.precioVenta) - Number(form.costo))})
                  </span>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} /> {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-guardar-producto" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : (editTarget ? 'Actualizar Producto' : 'Crear Producto')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">¿Desactivar producto?</h3>
            <p className="text-sm text-muted-foreground">El estado cambiará a <strong>INACTIVO</strong>. No se eliminará del sistema.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-confirmar-desactivar-prod" onClick={() => handleDesactivar(confirmId!)}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium">Desactivar</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl border border-border flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <History size={20} className="text-primary" /> Historial de Costos
                </h3>
                <p className="text-sm text-muted-foreground">{historyTarget.nombre}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
              ) : historialCostos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay historial de cambios de costo para este producto.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Proveedor</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costo Anterior</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costo Nuevo</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Variación</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Cant. Recibida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historialCostos.map(h => (
                      <tr key={h.idHistorialCosto} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {new Date(h.fechaRegistro).toLocaleDateString()} {new Date(h.fechaRegistro).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="px-4 py-3 text-foreground">{h.nombreProveedor}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmt(h.costoAnterior)}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{fmt(h.costoNuevo)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-semibold ${h.variacionPorcentaje > 0 ? 'text-rose-500' : h.variacionPorcentaje < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {h.variacionPorcentaje > 0 ? <TrendingUp size={14}/> : h.variacionPorcentaje < 0 ? <TrendingDown size={14}/> : null}
                            {h.variacionPorcentaje > 0 ? '+' : ''}{h.variacionPorcentaje}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{h.cantidadRecibida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
