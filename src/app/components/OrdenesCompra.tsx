import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Loader2, ShoppingCart, Search, ChevronDown, ChevronRight,
  Send, Ban, CheckCircle2, CreditCard, PackageCheck, Trash2, AlertTriangle
} from 'lucide-react';
import { ordenesCompraApi, proveedoresApi, productosApi, OrdenCompra, Proveedor, Producto } from '../../imports/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n ?? 0);

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR:          'bg-slate-500/15 text-slate-600',
  ENVIADA:           'bg-blue-500/15 text-blue-600',
  RECEPCION_PARCIAL: 'bg-amber-500/15 text-amber-700',
  COMPLETADA:        'bg-green-500/15 text-green-600',
  ANULADA:           'bg-rose-500/15 text-rose-600',
};

const PAGO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-rose-500/15 text-rose-600',
  PARCIAL:   'bg-amber-500/15 text-amber-700',
  SALDADO:   'bg-green-500/15 text-green-600',
};

type LineaOrden = { idProducto: number; nombre: string; cantidad: number; precioUnitario: number };

export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 15;

  // Detalle expandido
  const [expanded, setExpanded] = useState<number | null>(null);

  // Modal nueva orden
  const [showNueva, setShowNueva] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [idProveedorSel, setIdProveedorSel] = useState('');
  const [lineas, setLineas] = useState<LineaOrden[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal pago
  const [pagoOrdenId, setPagoOrdenId] = useState<number | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('TRANSFERENCIA');
  const [pagoRef, setPagoRef] = useState('');
  const [savingPago, setSavingPago] = useState(false);
  const [pagoError, setPagoError] = useState('');

  // Confirm action
  const [confirmAction, setConfirmAction] = useState<{ id: number; accion: 'anular' | 'forzar-cierre' } | null>(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordenesCompraApi.listar(page, PAGE_SIZE);
      setOrdenes(data.content);
      setTotalPages(data.totalPages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  const openNueva = async () => {
    setLineas([]);
    setIdProveedorSel('');
    setFormError('');
    try {
      const [pRes, prRes] = await Promise.all([
        proveedoresApi.listarActivos(),
        productosApi.listarActivos(),
      ]);
      setProveedores(pRes.content);
      setProductos(prRes.content);
    } catch { setFormError('Error cargando datos'); }
    setShowNueva(true);
  };

  const addLinea = () =>
    setLineas(l => [...l, { idProducto: 0, nombre: '', cantidad: 1, precioUnitario: 0 }]);

  const removeLinea = (i: number) =>
    setLineas(l => l.filter((_, idx) => idx !== i));

  const setLineaProducto = (i: number, idProducto: number) => {
    const prod = productos.find(p => p.idProducto === idProducto);
    setLineas(l => l.map((ln, idx) => idx === i
      ? { ...ln, idProducto, nombre: prod?.nombre ?? '', precioUnitario: prod?.costo ?? 0 }
      : ln));
  };

  const totalLineas = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);

  const handleCrear = async () => {
    if (!idProveedorSel) { setFormError('Selecciona un proveedor'); return; }
    if (lineas.length === 0) { setFormError('Agrega al menos un producto'); return; }
    if (lineas.some(l => !l.idProducto || l.cantidad < 1 || l.precioUnitario <= 0))
      { setFormError('Completa todos los productos correctamente'); return; }
    setSaving(true); setFormError('');
    try {
      await ordenesCompraApi.crear({
        idProveedor: Number(idProveedorSel),
        detalles: lineas.map(l => ({ idProducto: l.idProducto, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      });
      setShowNueva(false);
      fetchOrdenes();
    } catch (err: any) { setFormError(err.message || 'Error al crear'); }
    finally { setSaving(false); }
  };

  const handleEstado = async (id: number, accion: string) => {
    try {
      if (accion === 'enviar') await ordenesCompraApi.enviar(id);
      else if (accion === 'anular') await ordenesCompraApi.anular(id);
      else if (accion === 'forzar-cierre') await ordenesCompraApi.forzarCierre(id);
      fetchOrdenes();
    } finally { setConfirmAction(null); }
  };

  const handlePago = async () => {
    const monto = parseFloat(pagoMonto);
    if (!pagoOrdenId || isNaN(monto) || monto <= 0) { setPagoError('Ingresa un monto válido'); return; }
    setSavingPago(true); setPagoError('');
    try {
      await ordenesCompraApi.registrarPago(pagoOrdenId, {
        montoPagado: monto,
        metodo: pagoMetodo,
        numeroReferencia: pagoRef || undefined,
      });
      setPagoOrdenId(null);
      fetchOrdenes();
    } catch (err: any) { setPagoError(err.message || 'Error al registrar pago'); }
    finally { setSavingPago(false); }
  };

  const openPago = (id: number) => {
    setPagoOrdenId(id); setPagoMonto(''); setPagoMetodo('TRANSFERENCIA'); setPagoRef(''); setPagoError('');
  };

  const filtered = ordenes.filter(o =>
    o.nombreProveedor.toLowerCase().includes(search.toLowerCase()) ||
    String(o.idOrdenCompra).includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart size={26} className="text-primary" /> Órdenes de Compra
          </h2>
        </div>
        <button id="btn-nueva-orden" onClick={openNueva}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por proveedor o #orden..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay órdenes de compra</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground w-8"></th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Pago</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => (
                <>
                  <tr key={o.idOrdenCompra} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setExpanded(expanded === o.idOrdenCompra ? null : o.idOrdenCompra)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                        {expanded === o.idOrdenCompra ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">OC-{String(o.idOrdenCompra).padStart(4, '0')}</td>
                    <td className="px-4 py-3 font-medium">{o.nombreProveedor}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(o.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[o.estado] ?? 'bg-muted text-muted-foreground'}`}>
                        {o.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAGO_BADGE[o.estadoPago] ?? 'bg-muted text-muted-foreground'}`}>
                        {o.estadoPago}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${o.balancePendiente > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {fmt(o.balancePendiente)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {o.estado === 'BORRADOR' && (
                          <button id={`btn-enviar-${o.idOrdenCompra}`} onClick={() => handleEstado(o.idOrdenCompra, 'enviar')}
                            title="Enviar al proveedor"
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600 transition-colors">
                            <Send size={15} />
                          </button>
                        )}
                        {['ENVIADA', 'RECEPCION_PARCIAL'].includes(o.estado) && o.estadoPago !== 'SALDADO' && (
                          <button id={`btn-pago-${o.idOrdenCompra}`} onClick={() => openPago(o.idOrdenCompra)}
                            title="Registrar pago"
                            className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors">
                            <CreditCard size={15} />
                          </button>
                        )}
                        {['ENVIADA', 'RECEPCION_PARCIAL'].includes(o.estado) && (
                          <button id={`btn-forzar-${o.idOrdenCompra}`} onClick={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'forzar-cierre' })}
                            title="Forzar cierre"
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600 transition-colors">
                            <PackageCheck size={15} />
                          </button>
                        )}
                        {['BORRADOR', 'ENVIADA'].includes(o.estado) && (
                          <button id={`btn-anular-${o.idOrdenCompra}`} onClick={() => setConfirmAction({ id: o.idOrdenCompra, accion: 'anular' })}
                            title="Anular"
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-600 transition-colors">
                            <Ban size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === o.idOrdenCompra && (
                    <tr key={`exp-${o.idOrdenCompra}`} className="bg-muted/20">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Productos */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Productos</p>
                            <div className="space-y-1">
                              {o.detalles.map(d => (
                                <div key={d.idDetalleOrdenCompra} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2 border border-border">
                                  <span className="font-medium">{d.nombreProducto}</span>
                                  <div className="flex items-center gap-4 text-muted-foreground text-xs">
                                    <span>{d.cantidadRecibida}/{d.cantidad} recibidos</span>
                                    <span className="font-semibold text-foreground">{fmt(d.subtotal)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Pagos */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Pagos registrados</p>
                            {o.pagos.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">Sin pagos aún</p>
                            ) : (
                              <div className="space-y-1">
                                {o.pagos.map(p => (
                                  <div key={p.idPagoProveedor} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2 border border-border">
                                    <div>
                                      <span className="font-medium">{fmt(p.montoPagado)}</span>
                                      <span className="text-xs text-muted-foreground ml-2">• {p.metodo}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(p.fecha).toLocaleDateString('es-DO')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
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

      {/* Modal Nueva Orden */}
      {showNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold">Nueva Orden de Compra</h3>
              <button onClick={() => setShowNueva(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor <span className="text-rose-500">*</span></label>
                <select id="sel-proveedor-orden" value={idProveedorSel} onChange={e => setIdProveedorSel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => (
                    <option key={p.idProveedor} value={p.idProveedor}>{p.nombreEmpresa}</option>
                  ))}
                </select>
              </div>

              {/* Líneas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Productos <span className="text-rose-500">*</span></label>
                  <button onClick={addLinea}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus size={13} /> Agregar producto
                  </button>
                </div>
                {lineas.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">
                    Haz clic en "Agregar producto" para comenzar
                  </p>
                )}
                <div className="space-y-2">
                  {lineas.map((ln, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-lg p-3">
                      <div className="col-span-5">
                        <select value={ln.idProducto} onChange={e => setLineaProducto(i, Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                          <option value={0}>Seleccionar...</option>
                          {productos.map(p => <option key={p.idProducto} value={p.idProducto}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={1} value={ln.cantidad}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, cantidad: parseInt(e.target.value) || 1 } : x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none" placeholder="Cant." />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min={0} step={0.01} value={ln.precioUnitario}
                          onChange={e => setLineas(l => l.map((x, idx) => idx === i ? { ...x, precioUnitario: parseFloat(e.target.value) || 0 } : x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none" placeholder="Precio" />
                      </div>
                      <div className="col-span-1 text-right text-xs font-semibold text-muted-foreground">
                        {fmt(ln.cantidad * ln.precioUnitario)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeLinea(i)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {lineas.length > 0 && (
                  <div className="flex justify-end mt-2 text-sm font-bold">
                    Total: {fmt(totalLineas)}
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowNueva(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-crear-orden" onClick={handleCrear} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago */}
      {pagoOrdenId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Registrar Pago</h3>
              <button onClick={() => setPagoOrdenId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Monto <span className="text-rose-500">*</span></label>
                <input id="input-pago-monto" type="number" step={0.01} min={0.01} value={pagoMonto}
                  onChange={e => setPagoMonto(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Método</label>
                <select id="input-pago-metodo" value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Referencia</label>
                <input id="input-pago-referencia" type="text" value={pagoRef} onChange={e => setPagoRef(e.target.value)}
                  placeholder="Número de transacción (opcional)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              {pagoError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">
                  <X size={14} />{pagoError}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setPagoOrdenId(null)} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">Cancelar</button>
              <button id="btn-confirmar-pago" onClick={handlePago} disabled={savingPago}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-60">
                {savingPago && <Loader2 size={14} className="animate-spin" />}
                {savingPago ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${confirmAction.accion === 'anular' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
                {confirmAction.accion === 'anular'
                  ? <Ban size={20} className="text-rose-500" />
                  : <CheckCircle2 size={20} className="text-amber-600" />}
              </div>
              <h3 className="text-lg font-bold">
                {confirmAction.accion === 'anular' ? '¿Anular orden?' : '¿Forzar cierre?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction.accion === 'anular'
                ? 'La orden pasará a estado ANULADA. Esta acción no se puede deshacer.'
                : 'La orden se cerrará como COMPLETADA aunque haya mercancía pendiente de recibir.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button id="btn-confirmar-accion"
                onClick={() => handleEstado(confirmAction.id, confirmAction.accion)}
                className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
                  confirmAction.accion === 'anular' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {confirmAction.accion === 'anular' ? 'Anular' : 'Forzar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
