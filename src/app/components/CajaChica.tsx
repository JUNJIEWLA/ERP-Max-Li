import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Wallet,
  X,
} from 'lucide-react';
import {
  CajaChica as CajaChicaType,
  MovimientoCaja,
  TipoMovimientoCaja,
  cajasChicasApi,
  movimientosCajaApi,
} from '../../imports/api';

const CAJA_PAGE_SIZE = 12;
const MOVEMENT_PAGE_SIZE = 8;

type CajaForm = {
  nombre: string;
  responsable: string;
  saldoActual: string;
  limiteMonto: string;
  estado: 'ACTIVO' | 'INACTIVO';
};

type MovimientoForm = {
  tipoMovimiento: TipoMovimientoCaja;
  monto: string;
  concepto: string;
};

const emptyCajaForm: CajaForm = {
  nombre: '',
  responsable: '',
  saldoActual: '',
  limiteMonto: '',
  estado: 'ACTIVO',
};

const emptyMovimientoForm: MovimientoForm = {
  tipoMovimiento: 'EGRESO',
  monto: '',
  concepto: '',
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(value ?? 0);

const dateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

const toNumber = (value: string) => Number(value.replace(',', '.'));

export default function CajaChica() {
  const [cajas, setCajas] = useState<CajaChicaType[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loadingCajas, setLoadingCajas] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [error, setError] = useState('');
  const [movementError, setMovementError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [movementPage, setMovementPage] = useState(0);
  const [movementTotalPages, setMovementTotalPages] = useState(0);

  const [showCajaModal, setShowCajaModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CajaChicaType | null>(null);
  const [cajaForm, setCajaForm] = useState<CajaForm>(emptyCajaForm);
  const [cajaFormError, setCajaFormError] = useState('');
  const [savingCaja, setSavingCaja] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null);

  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [movimientoForm, setMovimientoForm] = useState<MovimientoForm>(emptyMovimientoForm);
  const [movimientoFormError, setMovimientoFormError] = useState('');
  const [savingMovimiento, setSavingMovimiento] = useState(false);

  const selectedCaja = cajas.find((caja) => caja.idCajaChica === selectedId) ?? null;

  const fetchCajas = useCallback(async () => {
    setLoadingCajas(true);
    setError('');
    try {
      const data = await cajasChicasApi.listar(page, CAJA_PAGE_SIZE);
      setCajas(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);

      if (data.content.length === 0) {
        setSelectedId(null);
      } else if (!selectedId || !data.content.some((caja) => caja.idCajaChica === selectedId)) {
        setSelectedId(data.content[0].idCajaChica);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar cajas chicas');
    } finally {
      setLoadingCajas(false);
    }
  }, [page, selectedId]);

  const fetchMovimientos = useCallback(async () => {
    if (!selectedId) {
      setMovimientos([]);
      setMovementTotalPages(0);
      return;
    }

    setLoadingMovimientos(true);
    setMovementError('');
    try {
      const data = await movimientosCajaApi.listarPorCajaChica(selectedId, movementPage, MOVEMENT_PAGE_SIZE);
      setMovimientos(data.content);
      setMovementTotalPages(data.totalPages);
    } catch (err: any) {
      setMovementError(err.message || 'Error al cargar movimientos');
    } finally {
      setLoadingMovimientos(false);
    }
  }, [movementPage, selectedId]);

  useEffect(() => {
    fetchCajas();
  }, [fetchCajas]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos]);

  const refreshSelected = async () => {
    await fetchCajas();
    await fetchMovimientos();
  };

  const openCreateCaja = () => {
    setEditTarget(null);
    setCajaForm(emptyCajaForm);
    setCajaFormError('');
    setShowCajaModal(true);
  };

  const openEditCaja = (caja: CajaChicaType) => {
    setEditTarget(caja);
    setCajaForm({
      nombre: caja.nombre,
      responsable: caja.responsable,
      saldoActual: String(caja.saldoActual),
      limiteMonto: String(caja.limiteMonto),
      estado: caja.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
    });
    setCajaFormError('');
    setShowCajaModal(true);
  };

  const closeCajaModal = () => {
    setShowCajaModal(false);
    setEditTarget(null);
    setCajaFormError('');
    setSavingCaja(false);
  };

  const validateCajaForm = () => {
    const saldoActual = toNumber(cajaForm.saldoActual);
    const limiteMonto = toNumber(cajaForm.limiteMonto);

    if (!cajaForm.nombre.trim()) return 'El nombre es obligatorio';
    if (!cajaForm.responsable.trim()) return 'El responsable es obligatorio';
    if (Number.isNaN(saldoActual) || saldoActual < 0) return 'El saldo actual debe ser cero o mayor';
    if (Number.isNaN(limiteMonto) || limiteMonto <= 0) return 'El limite debe ser mayor a cero';
    if (saldoActual > limiteMonto) return 'El saldo actual no puede superar el limite';
    return '';
  };

  const handleCajaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateCajaForm();
    if (validationError) {
      setCajaFormError(validationError);
      return;
    }

    setSavingCaja(true);
    setCajaFormError('');
    try {
      const body = {
        nombre: cajaForm.nombre.trim(),
        responsable: cajaForm.responsable.trim(),
        saldoActual: toNumber(cajaForm.saldoActual),
        limiteMonto: toNumber(cajaForm.limiteMonto),
        estado: cajaForm.estado,
      };

      const saved = editTarget
        ? await cajasChicasApi.actualizar(editTarget.idCajaChica, body)
        : await cajasChicasApi.crear(body);

      setSelectedId(saved.idCajaChica);
      closeCajaModal();
      await fetchCajas();
    } catch (err: any) {
      setCajaFormError(err.message || 'Error al guardar caja chica');
    } finally {
      setSavingCaja(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivateId) return;

    try {
      await cajasChicasApi.desactivar(confirmDeactivateId);
      setConfirmDeactivateId(null);
      await fetchCajas();
    } catch (err: any) {
      setError(err.message || 'Error al desactivar caja chica');
      setConfirmDeactivateId(null);
    }
  };

  const openMovimiento = (tipoMovimiento: TipoMovimientoCaja = 'EGRESO') => {
    if (!selectedCaja || selectedCaja.estado !== 'ACTIVO') return;
    setMovimientoForm({ ...emptyMovimientoForm, tipoMovimiento });
    setMovimientoFormError('');
    setShowMovimientoModal(true);
  };

  const closeMovimientoModal = () => {
    setShowMovimientoModal(false);
    setMovimientoFormError('');
    setSavingMovimiento(false);
  };

  const validateMovimientoForm = () => {
    if (!selectedCaja) return 'Selecciona una caja chica';

    const monto = toNumber(movimientoForm.monto);
    if (Number.isNaN(monto) || monto <= 0) return 'El monto debe ser mayor a cero';
    if (!movimientoForm.concepto.trim()) return 'El concepto es obligatorio';
    if (movimientoForm.tipoMovimiento === 'EGRESO' && monto > selectedCaja.saldoActual) {
      return 'El egreso no puede superar el saldo actual';
    }
    if (movimientoForm.tipoMovimiento === 'INGRESO' && selectedCaja.saldoActual + monto > selectedCaja.limiteMonto) {
      return 'El ingreso supera el limite de la caja chica';
    }

    return '';
  };

  const handleMovimientoSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCaja) return;

    const validationError = validateMovimientoForm();
    if (validationError) {
      setMovimientoFormError(validationError);
      return;
    }

    setSavingMovimiento(true);
    setMovimientoFormError('');
    try {
      await movimientosCajaApi.registrar(selectedCaja.idCajaChica, {
        tipoMovimiento: movimientoForm.tipoMovimiento,
        monto: toNumber(movimientoForm.monto),
        concepto: movimientoForm.concepto.trim(),
      });
      closeMovimientoModal();
      setMovementPage(0);
      await refreshSelected();
    } catch (err: any) {
      setMovimientoFormError(err.message || 'Error al registrar movimiento');
    } finally {
      setSavingMovimiento(false);
    }
  };

  const filteredCajas = cajas.filter((caja) => {
    const term = search.toLowerCase();
    return (
      caja.nombre.toLowerCase().includes(term) ||
      caja.responsable.toLowerCase().includes(term) ||
      caja.estado.toLowerCase().includes(term)
    );
  });

  const activeCount = cajas.filter((caja) => caja.estado === 'ACTIVO').length;
  const totalSaldo = cajas.reduce((sum, caja) => sum + caja.saldoActual, 0);
  const totalLimite = cajas.reduce((sum, caja) => sum + caja.limiteMonto, 0);
  const usagePct = totalLimite > 0 ? Math.min(100, (totalSaldo / totalLimite) * 100) : 0;
  const selectedUsagePct = selectedCaja?.limiteMonto
    ? Math.min(100, (selectedCaja.saldoActual / selectedCaja.limiteMonto) * 100)
    : 0;
  const remainingSelected = selectedCaja ? selectedCaja.limiteMonto - selectedCaja.saldoActual : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet size={26} className="text-primary" />
            Caja Chica
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Fondos menores, reposiciones y egresos con trazabilidad por usuario
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            id="btn-movimiento-ingreso-caja-chica"
            onClick={() => openMovimiento('INGRESO')}
            disabled={!selectedCaja || selectedCaja.estado !== 'ACTIVO'}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
          >
            <ArrowUpCircle size={18} />
            Ingreso
          </button>
          <button
            id="btn-movimiento-egreso-caja-chica"
            onClick={() => openMovimiento('EGRESO')}
            disabled={!selectedCaja || selectedCaja.estado !== 'ACTIVO'}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
          >
            <ArrowDownCircle size={18} />
            Egreso
          </button>
          <button
            id="btn-nueva-caja-chica"
            onClick={openCreateCaja}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Nueva Caja
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Saldo total en página</p>
              <p className="text-2xl font-semibold mt-1">{money(totalSaldo)}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Wallet size={22} />
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${usagePct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Uso acumulado: {usagePct.toFixed(0)}% del limite</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Cajas activas en página</p>
              <p className="text-2xl font-semibold mt-1">{activeCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-green-500 text-white flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {totalElements} caja{totalElements !== 1 ? 's' : ''} registrada{totalElements !== 1 ? 's' : ''} en total
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Caja seleccionada</p>
              <p className="text-lg font-semibold mt-1 truncate">{selectedCaja?.nombre ?? 'Sin selección'}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500 text-white flex items-center justify-center">
              <Activity size={22} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Disponible: {money(selectedCaja ? remainingSelected : 0)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)] gap-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por caja, responsable o estado..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredCajas.length} de {cajas.length} en esta página
            </p>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {loadingCajas ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            ) : filteredCajas.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Wallet size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontraron cajas chicas</p>
                {search && <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Caja</th>
                      <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Responsable</th>
                      <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Saldo</th>
                      <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Limite</th>
                      <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                      <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCajas.map((caja) => {
                      const cajaUsage = caja.limiteMonto > 0 ? Math.min(100, (caja.saldoActual / caja.limiteMonto) * 100) : 0;
                      const isSelected = caja.idCajaChica === selectedId;

                      return (
                        <tr
                          key={caja.idCajaChica}
                          onClick={() => {
                            setSelectedId(caja.idCajaChica);
                            setMovementPage(0);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-foreground">{caja.nombre}</div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${cajaUsage}%` }} />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{caja.responsable}</td>
                          <td className="px-5 py-4 text-right font-medium">{money(caja.saldoActual)}</td>
                          <td className="px-5 py-4 text-right text-muted-foreground">{money(caja.limiteMonto)}</td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                caja.estado === 'ACTIVO'
                                  ? 'bg-green-500/15 text-green-600'
                                  : 'bg-rose-500/15 text-rose-600'
                              }`}
                            >
                              {caja.estado}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                id={`btn-editar-caja-chica-${caja.idCajaChica}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditCaja(caja);
                                }}
                                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                id={`btn-desactivar-caja-chica-${caja.idCajaChica}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setConfirmDeactivateId(caja.idCajaChica);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  caja.estado === 'ACTIVO'
                                    ? 'text-rose-500 hover:bg-rose-500/10'
                                    : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title={caja.estado === 'ACTIVO' ? 'Desactivar' : 'Ya está inactiva'}
                                disabled={caja.estado !== 'ACTIVO'}
                              >
                                {caja.estado === 'ACTIVO' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            {selectedCaja ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Detalle seleccionado</p>
                    <h3 className="mt-1 text-xl font-semibold">{selectedCaja.nombre}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Responsable: {selectedCaja.responsable}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedCaja.estado === 'ACTIVO'
                        ? 'bg-green-500/15 text-green-600'
                        : 'bg-rose-500/15 text-rose-600'
                    }`}
                  >
                    {selectedCaja.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Saldo actual</p>
                    <p className="font-semibold mt-1">{money(selectedCaja.saldoActual)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Limite</p>
                    <p className="font-semibold mt-1">{money(selectedCaja.limiteMonto)}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Uso del fondo</span>
                    <span>{selectedUsagePct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${selectedUsagePct >= 90 ? 'bg-rose-500' : 'bg-primary'}`}
                      style={{ width: `${selectedUsagePct}%` }}
                    />
                  </div>
                </div>

                {selectedCaja.estado !== 'ACTIVO' && (
                  <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    Esta caja está inactiva. No se pueden registrar movimientos hasta reactivarla desde edición.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Wallet size={42} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Selecciona una caja chica</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <ReceiptText size={19} className="text-primary" />
                  Movimientos
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Historial reciente de la caja seleccionada</p>
              </div>
              {selectedCaja && (
                <button
                  onClick={() => openMovimiento('EGRESO')}
                  disabled={selectedCaja.estado !== 'ACTIVO'}
                  className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  Registrar
                </button>
              )}
            </div>

            {movementError && (
              <div className="m-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
                {movementError}
              </div>
            )}

            {loadingMovimientos ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ReceiptText size={42} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin movimientos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {movimientos.map((movimiento) => {
                  const ingreso = movimiento.tipoMovimiento === 'INGRESO';

                  return (
                    <div key={movimiento.idMovimiento} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${
                              ingreso ? 'bg-green-500/15 text-green-600' : 'bg-rose-500/15 text-rose-600'
                            }`}
                          >
                            {ingreso ? <ArrowUpCircle size={19} /> : <ArrowDownCircle size={19} />}
                          </div>
                          <div>
                            <p className="font-medium">{movimiento.concepto}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dateTime(movimiento.fechaHora)} · {movimiento.username}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${ingreso ? 'text-green-600' : 'text-rose-600'}`}>
                            {ingreso ? '+' : '-'}{money(movimiento.monto)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Saldo: {money(movimiento.saldoActualCajaChica)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {movementTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
                <span>Página {movementPage + 1} de {movementTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMovementPage((current) => Math.max(0, current - 1))}
                    disabled={movementPage === 0}
                    className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setMovementPage((current) => Math.min(movementTotalPages - 1, current + 1))}
                    disabled={movementPage >= movementTotalPages - 1}
                    className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showCajaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCajaModal();
          }}
        >
          <form
            onSubmit={handleCajaSubmit}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold">{editTarget ? 'Editar Caja Chica' : 'Nueva Caja Chica'}</h3>
              <button type="button" onClick={closeCajaModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {cajaFormError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
                  {cajaFormError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Nombre <span className="text-rose-500">*</span></label>
                <input
                  value={cajaForm.nombre}
                  onChange={(event) => setCajaForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: Caja Chica Administración"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Responsable <span className="text-rose-500">*</span></label>
                <input
                  value={cajaForm.responsable}
                  onChange={(event) => setCajaForm((current) => ({ ...current, responsable: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: Administración"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Saldo actual <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cajaForm.saldoActual}
                    onChange={(event) => setCajaForm((current) => ({ ...current, saldoActual: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Limite <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={cajaForm.limiteMonto}
                    onChange={(event) => setCajaForm((current) => ({ ...current, limiteMonto: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="10000.00"
                  />
                </div>
              </div>

              {editTarget && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Estado</label>
                  <select
                    value={cajaForm.estado}
                    onChange={(event) => setCajaForm((current) => ({ ...current, estado: event.target.value as CajaForm['estado'] }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={closeCajaModal}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCaja}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingCaja && <Loader2 size={16} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {showMovimientoModal && selectedCaja && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMovimientoModal();
          }}
        >
          <form
            onSubmit={handleMovimientoSubmit}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">Registrar Movimiento</h3>
                <p className="text-sm text-muted-foreground">{selectedCaja.nombre}</p>
              </div>
              <button type="button" onClick={closeMovimientoModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {movimientoFormError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
                  {movimientoFormError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['INGRESO', 'EGRESO'] as TipoMovimientoCaja[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setMovimientoForm((current) => ({ ...current, tipoMovimiento: tipo }))}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        movimientoForm.tipoMovimiento === tipo
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Monto <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={movimientoForm.monto}
                  onChange={(event) => setMovimientoForm((current) => ({ ...current, monto: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Saldo actual: {money(selectedCaja.saldoActual)} · Disponible hasta limite: {money(remainingSelected)}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Concepto <span className="text-rose-500">*</span></label>
                <textarea
                  value={movimientoForm.concepto}
                  onChange={(event) => setMovimientoForm((current) => ({ ...current, concepto: event.target.value }))}
                  className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: Compra de material de oficina"
                  maxLength={255}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={closeMovimientoModal}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingMovimiento}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingMovimiento && <Loader2 size={16} className="animate-spin" />}
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeactivateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Desactivar caja chica</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esto no elimina el registro. Solo cambia el estado a INACTIVO y bloquea nuevos movimientos.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm text-white hover:bg-rose-600 transition-colors"
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
