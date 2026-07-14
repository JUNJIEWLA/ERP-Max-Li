import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, ReceiptText, Search, Wallet, X } from 'lucide-react';
import { Gasto, OrdenCompraDisponible, gastosApi } from '../../imports/api';

const PAGE_SIZE = 15;

const money = (value: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value ?? 0);

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ordenesDisponibles, setOrdenesDisponibles] = useState<OrdenCompraDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const loadGastos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await gastosApi.listar(page, PAGE_SIZE);
      setGastos(data.content);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadOrdenesDisponibles = useCallback(async () => {
    try {
      setOrdenesDisponibles(await gastosApi.listarOrdenesDisponibles());
    } catch (err: any) {
      setFormError(err.message || 'Error al cargar las compras disponibles');
    }
  }, []);

  useEffect(() => {
    loadGastos();
  }, [loadGastos]);

  const openCreate = async () => {
    setSelectedOrder('');
    setFormError('');
    setShowCreate(true);
    await loadOrdenesDisponibles();
  };

  const filteredGastos = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return gastos;
    return gastos.filter((gasto) =>
      gasto.nombreProveedor.toLowerCase().includes(value) ||
      String(gasto.idOrdenCompra).includes(value),
    );
  }, [gastos, search]);

  const pendingAmount = gastos
    .filter((gasto) => gasto.estado === 'PENDIENTE')
    .reduce((sum, gasto) => sum + gasto.monto, 0);
  const completedAmount = gastos
    .filter((gasto) => gasto.estado === 'REALIZADO')
    .reduce((sum, gasto) => sum + gasto.monto, 0);

  const createGasto = async () => {
    if (!selectedOrder) {
      setFormError('Selecciona una orden de compra');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await gastosApi.crear(Number(selectedOrder));
      setShowCreate(false);
      await Promise.all([loadGastos(), loadOrdenesDisponibles()]);
    } catch (err: any) {
      setFormError(err.message || 'No se pudo registrar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const markAsCompleted = async (idGasto: number) => {
    setMarkingId(idGasto);
    setError('');
    try {
      await gastosApi.marcarComoRealizado(idGasto);
      await loadGastos();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el gasto');
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet size={26} className="text-primary" /> Gastos
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Pagos a proveedores registrados para compras recepcionadas</p>
        </div>
        <button
          id="btn-registrar-gasto"
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={17} /> Registrar gasto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-border bg-card rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Pendiente</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{money(pendingAmount)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Realizado</p>
          <p className="mt-1 text-xl font-bold text-green-600">{money(completedAmount)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Registros en esta página</p>
          <p className="mt-1 text-xl font-bold text-foreground">{gastos.length}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por proveedor o #orden..."
          className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" title="Limpiar búsqueda">
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/10 text-rose-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="border border-border overflow-x-auto bg-card rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={30} className="animate-spin text-primary" /></div>
        ) : filteredGastos.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <ReceiptText size={42} className="mx-auto mb-3 opacity-35" />
            <p className="font-medium">No hay gastos registrados</p>
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Compra</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Monto</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Registrado</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredGastos.map((gasto) => (
                <tr key={gasto.idGasto} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">OC-{String(gasto.idOrdenCompra).padStart(4, '0')}</td>
                  <td className="px-4 py-3 font-medium">{gasto.nombreProveedor}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(gasto.monto)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      gasto.estado === 'REALIZADO'
                        ? 'bg-green-500/15 text-green-700'
                        : 'bg-amber-500/15 text-amber-700'
                    }`}>
                      {gasto.estado === 'REALIZADO' ? 'Realizado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{dateTime(gasto.fechaRegistro)}</td>
                  <td className="px-4 py-3 text-center">
                    {gasto.estado === 'PENDIENTE' ? (
                      <button
                        onClick={() => markAsCompleted(gasto.idGasto)}
                        disabled={markingId === gasto.idGasto}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {markingId === gasto.idGasto ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Marcar realizado
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{dateTime(gasto.fechaRealizado)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Anterior</button>
          <button onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Siguiente</button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold">Registrar gasto a proveedor</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Solo se muestran compras completamente recepcionadas.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Cerrar"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Orden de compra</label>
                <select
                  value={selectedOrder}
                  onChange={(event) => setSelectedOrder(event.target.value)}
                  disabled={ordenesDisponibles.length === 0}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                >
                  <option value="">Seleccionar orden...</option>
                  {ordenesDisponibles.map((orden) => (
                    <option key={orden.idOrdenCompra} value={orden.idOrdenCompra}>
                      OC-{String(orden.idOrdenCompra).padStart(4, '0')} · {orden.nombreProveedor} · {money(orden.total)}
                    </option>
                  ))}
                </select>
                {ordenesDisponibles.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No hay compras recepcionadas disponibles.</p>}
              </div>
              {formError && <p className="text-sm text-rose-600">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={createGasto} disabled={saving || ordenesDisponibles.length === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />} Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
