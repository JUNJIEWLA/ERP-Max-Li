import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Search,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  X,
  ShieldCheck,
  Activity,
  ReceiptText,
  Filter,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  UserCheck,
  CreditCard,
} from 'lucide-react';
import {
  CajaChica as CajaChicaType,
  MovimientoCaja,
  TipoMovimientoCaja,
  cajasChicasApi,
  movimientosCajaApi,
} from '../../imports/api';

const CAJA_PAGE_SIZE = 12;
const MOVEMENT_PAGE_SIZE = 10;

type CajaForm = {
  nombre: string;
  responsable: string;
  saldoActual: string;
  limiteMonto: string;
  estado: 'ACTIVO' | 'INACTIVO';
};

type MovimientoForm = {
  idCajaChica: number | null;
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
  idCajaChica: null,
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
    ? new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '-';

const toNumber = (value: string) => Number(value.replace(',', '.'));

export default function CajaChica() {
  // Pestaña activa: 'cajas' o 'movimientos'
  const [activeTab, setActiveTab] = useState<'cajas' | 'movimientos'>('cajas');

  // Estados de datos
  const [cajas, setCajas] = useState<CajaChicaType[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Filtros y búsquedas
  const [searchCajas, setSearchCajas] = useState('');
  const [searchMovimientos, setSearchMovimientos] = useState('');
  const [filterTipoMovimiento, setFilterTipoMovimiento] = useState<string>('TODOS');
  const [filterCajaId, setFilterCajaId] = useState<string>('TODAS');

  // Loading y errores
  const [loadingCajas, setLoadingCajas] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [error, setError] = useState('');
  const [movementError, setMovementError] = useState('');

  // Paginación cajas
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Paginación movimientos
  const [movementPage, setMovementPage] = useState(0);
  const [movementTotalPages, setMovementTotalPages] = useState(0);

  // Modales
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

  // Cargar Cajas
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

  // Cargar Movimientos de la caja seleccionada
  const fetchMovimientos = useCallback(async () => {
    const targetCajaId = filterCajaId !== 'TODAS' ? Number(filterCajaId) : selectedId;

    if (!targetCajaId) {
      setMovimientos([]);
      setMovementTotalPages(0);
      return;
    }

    setLoadingMovimientos(true);
    setMovementError('');
    try {
      const data = await movimientosCajaApi.listarPorCajaChica(targetCajaId, movementPage, MOVEMENT_PAGE_SIZE);
      setMovimientos(data.content);
      setMovementTotalPages(data.totalPages);
    } catch (err: any) {
      setMovementError(err.message || 'Error al cargar movimientos de caja');
    } finally {
      setLoadingMovimientos(false);
    }
  }, [movementPage, selectedId, filterCajaId]);

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

  // Abrir modal crear/editar caja
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
    if (Number.isNaN(limiteMonto) || limiteMonto <= 0) return 'El límite debe ser mayor a cero';
    if (saldoActual > limiteMonto) return 'El saldo actual no puede superar el límite';
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

  // Modal registrar movimiento
  const openMovimiento = (tipoMovimiento: TipoMovimientoCaja = 'EGRESO', cajaIdOverride?: number) => {
    const targetCajaId = cajaIdOverride || selectedId;
    const targetCaja = cajas.find((c) => c.idCajaChica === targetCajaId) || selectedCaja;

    if (!targetCaja || targetCaja.estado !== 'ACTIVO') return;

    setMovimientoForm({
      ...emptyMovimientoForm,
      idCajaChica: targetCaja.idCajaChica,
      tipoMovimiento,
    });
    setMovimientoFormError('');
    setShowMovimientoModal(true);
  };

  const closeMovimientoModal = () => {
    setShowMovimientoModal(false);
    setMovimientoFormError('');
    setSavingMovimiento(false);
  };

  const validateMovimientoForm = () => {
    const targetCaja = cajas.find((c) => c.idCajaChica === movimientoForm.idCajaChica);
    if (!targetCaja) return 'Selecciona una caja chica válida';

    const monto = toNumber(movimientoForm.monto);
    if (Number.isNaN(monto) || monto <= 0) return 'El monto debe ser mayor a cero';
    if (!movimientoForm.concepto.trim()) return 'El concepto es obligatorio';
    if (movimientoForm.tipoMovimiento === 'EGRESO' && monto > targetCaja.saldoActual) {
      return 'El egreso no puede superar el saldo actual de la caja';
    }
    if (movimientoForm.tipoMovimiento === 'INGRESO' && targetCaja.saldoActual + monto > targetCaja.limiteMonto) {
      return 'El ingreso supera el límite configurado para la caja chica';
    }

    return '';
  };

  const handleMovimientoSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!movimientoForm.idCajaChica) return;

    const validationError = validateMovimientoForm();
    if (validationError) {
      setMovimientoFormError(validationError);
      return;
    }

    setSavingMovimiento(true);
    setMovimientoFormError('');
    try {
      await movimientosCajaApi.registrar(movimientoForm.idCajaChica, {
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

  // Filtrado de cajas
  const filteredCajas = cajas.filter((caja) => {
    const term = searchCajas.toLowerCase();
    return (
      caja.nombre.toLowerCase().includes(term) ||
      caja.responsable.toLowerCase().includes(term) ||
      caja.estado.toLowerCase().includes(term)
    );
  });

  // Filtrado de movimientos local
  const filteredMovimientos = movimientos.filter((mov) => {
    const term = searchMovimientos.toLowerCase();
    const matchesTerm =
      mov.concepto.toLowerCase().includes(term) ||
      mov.username.toLowerCase().includes(term) ||
      mov.cajaChicaNombre?.toLowerCase().includes(term);
    const matchesTipo = filterTipoMovimiento === 'TODOS' || mov.tipoMovimiento === filterTipoMovimiento;
    return matchesTerm && matchesTipo;
  });

  // Totales ejecutivos
  const activeCount = cajas.filter((caja) => caja.estado === 'ACTIVO').length;
  const totalSaldo = cajas.reduce((sum, caja) => sum + (caja.estado === 'ACTIVO' ? caja.saldoActual : 0), 0);
  const totalLimite = cajas.reduce((sum, caja) => sum + (caja.estado === 'ACTIVO' ? caja.limiteMonto : 0), 0);
  const globalUsagePct = totalLimite > 0 ? Math.min(100, (totalSaldo / totalLimite) * 100) : 0;

  const totalIngresosVista = movimientos
    .filter((m) => m.tipoMovimiento === 'INGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalEgresosVista = movimientos
    .filter((m) => m.tipoMovimiento === 'EGRESO')
    .reduce((sum, m) => sum + m.monto, 0);

  const selectedUsagePct = selectedCaja?.limiteMonto
    ? Math.min(100, (selectedCaja.saldoActual / selectedCaja.limiteMonto) * 100)
    : 0;

  const remainingSelected = selectedCaja ? selectedCaja.limiteMonto - selectedCaja.saldoActual : 0;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* ── 1. Header Ejecutivo ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <Wallet size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Caja Chica & Movimientos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Control de fondos menores, gastos operativos y auditoría de movimientos
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción principal */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-movimiento-ingreso-caja-chica"
            onClick={() => openMovimiento('INGRESO')}
            disabled={!selectedCaja || selectedCaja.estado !== 'ACTIVO'}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
          >
            <ArrowUpCircle size={18} />
            Ingreso
          </button>

          <button
            id="btn-movimiento-egreso-caja-chica"
            onClick={() => openMovimiento('EGRESO')}
            disabled={!selectedCaja || selectedCaja.estado !== 'ACTIVO'}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/20 transition-all disabled:opacity-40"
          >
            <ArrowDownCircle size={18} />
            Egreso
          </button>

          <button
            id="btn-nueva-caja-chica"
            onClick={openCreateCaja}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus size={18} />
            Nueva Caja
          </button>
        </div>
      </div>

      {/* ── 2. KPI Cards Superiores ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Saldo Disponible */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[135px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Total Disponible</p>
              <p className="text-2xl font-bold text-foreground mt-1">{money(totalSaldo)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Wallet size={20} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Nivel de ocupación</span>
              <span className="font-mono font-medium">{globalUsagePct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  globalUsagePct > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${globalUsagePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Límite Global */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[135px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Límite Fondo Aprobado</p>
              <p className="text-2xl font-bold text-foreground mt-1">{money(totalLimite)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>{activeCount} de {totalElements} caja{totalElements !== 1 ? 's' : ''} activa{totalElements !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Card 3: Ingresos Recientes */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[135px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingresos (Vista)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{money(totalIngresosVista)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
            Reposiciones e ingresos de fondos
          </div>
        </div>

        {/* Card 4: Egresos Recientes */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[135px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Egresos (Vista)</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{money(totalEgresosVista)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
            Gastos y pagos menores efectuados
          </div>
        </div>
      </div>

      {/* ── Banner de errores globales ────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-rose-600 hover:opacity-80">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── 3. Navegación por Pestañas (Apartados) ────────────────── */}
      <div className="border-b border-border">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('cajas')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'cajas'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wallet size={18} />
            Cajas Chicas
            <span className="ml-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-bold">
              {cajas.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('movimientos')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'movimientos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ReceiptText size={18} />
            Historial de Movimientos
            {movimientos.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs px-2 py-0.5 font-bold">
                {movimientos.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ── 4. APARTADO 1: GESTIÓN DE CAJAS CHICAS ───────────────── */}
      {activeTab === 'cajas' && (
        <div className="space-y-4">
          {/* Toolbar de búsqueda global sobre las columnas */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="relative max-w-sm w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar caja, responsable o estado..."
                value={searchCajas}
                onChange={(e) => setSearchCajas(e.target.value)}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchCajas && (
                <button
                  onClick={() => setSearchCajas('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Mostrando {filteredCajas.length} de {cajas.length} cajas chicas
            </p>
          </div>

          {/* Grid de 2 columnas con bordes e inicio perfectamente nivelados */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)] gap-6 items-start">
            {/* Columna Izquierda: Tabla/Grid de Cajas */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm min-h-[220px]">
                {loadingCajas ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                ) : filteredCajas.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Wallet size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-foreground">No se encontraron cajas chicas</p>
                    {searchCajas && <p className="text-xs mt-1">Intenta con otro término de búsqueda</p>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-5 py-3 text-left font-semibold text-muted-foreground text-xs uppercase">Caja Chica</th>
                          <th className="px-5 py-3 text-left font-semibold text-muted-foreground text-xs uppercase">Responsable</th>
                          <th className="px-5 py-3 text-right font-semibold text-muted-foreground text-xs uppercase">Saldo Actual</th>
                          <th className="px-5 py-3 text-right font-semibold text-muted-foreground text-xs uppercase">Límite</th>
                          <th className="px-5 py-3 text-center font-semibold text-muted-foreground text-xs uppercase">Estado</th>
                          <th className="px-5 py-3 text-center font-semibold text-muted-foreground text-xs uppercase">Acciones</th>
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
                                isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                              }`}
                            >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-foreground">{caja.nombre}</div>
                              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden max-w-[140px]">
                                <div
                                  className={`h-full rounded-full ${
                                    cajaUsage > 85 ? 'bg-rose-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${cajaUsage}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-5 py-4 text-muted-foreground font-medium">{caja.responsable}</td>
                            <td className="px-5 py-4 text-right font-mono font-bold text-foreground">
                              {money(caja.saldoActual)}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-muted-foreground">
                              {money(caja.limiteMonto)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  caja.estado === 'ACTIVO'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : 'bg-rose-500/15 text-rose-600'
                                }`}
                              >
                                {caja.estado}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-1.5">
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
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                <span>Página {page + 1} de {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors text-xs font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors text-xs font-medium"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Panel Detallado de Caja Seleccionada */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
              {selectedCaja ? (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Caja Chica Seleccionada</span>
                      <h3 className="mt-1 text-xl font-bold text-foreground">{selectedCaja.nombre}</h3>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <UserCheck size={14} className="text-primary" />
                        Responsable: <span className="font-semibold text-foreground">{selectedCaja.responsable}</span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        selectedCaja.estado === 'ACTIVO'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}
                    >
                      {selectedCaja.estado}
                    </span>
                  </div>

                  {/* Tarjetas de Saldo y Límite */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Saldo Disponible</p>
                      <p className="font-mono font-extrabold text-lg text-emerald-700 dark:text-emerald-300 mt-1">
                        {money(selectedCaja.saldoActual)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Límite Aprobado</p>
                      <p className="font-mono font-extrabold text-lg text-blue-700 dark:text-blue-300 mt-1">
                        {money(selectedCaja.limiteMonto)}
                      </p>
                    </div>
                  </div>

                  {/* Medidor de Uso */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                      <span>Uso del fondo asignado</span>
                      <span className="font-mono font-bold text-foreground">{selectedUsagePct.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedUsagePct >= 90 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${selectedUsagePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-right">
                      Disponible para reposición: <span className="font-mono font-semibold text-foreground">{money(remainingSelected)}</span>
                    </p>
                  </div>

                  {/* Botones de Operación Rápida */}
                  {selectedCaja.estado === 'ACTIVO' ? (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => openMovimiento('INGRESO', selectedCaja.idCajaChica)}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        <ArrowUpCircle size={16} />
                        Registrar Ingreso
                      </button>

                      <button
                        onClick={() => openMovimiento('EGRESO', selectedCaja.idCajaChica)}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        <ArrowDownCircle size={16} />
                        Registrar Egreso
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Caja Inactiva</p>
                        <p className="mt-0.5">No se pueden registrar ingresos ni egresos hasta cambiar el estado a ACTIVO.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Selecciona una caja chica de la lista</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── 5. APARTADO 2: HISTORIAL DE MOVIMIENTOS ─────────────── */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          {/* Barra de Filtros de Movimientos */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Filtros de Auditoría</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Selección de Caja Chica */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Caja Chica</label>
                <select
                  value={filterCajaId}
                  onChange={(e) => {
                    setFilterCajaId(e.target.value);
                    setMovementPage(0);
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="TODAS">Caja Actual ({selectedCaja?.nombre || 'Seleccionada'})</option>
                  {cajas.map((c) => (
                    <option key={c.idCajaChica} value={c.idCajaChica}>
                      {c.nombre} ({c.estado})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selección de Tipo */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Movimiento</label>
                <select
                  value={filterTipoMovimiento}
                  onChange={(e) => setFilterTipoMovimiento(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="TODOS">Todos (Ingresos y Egresos)</option>
                  <option value="INGRESO">Solo Ingresos (+)</option>
                  <option value="EGRESO">Solo Egresos (-)</option>
                </select>
              </div>

              {/* Búsqueda por Concepto / Usuario */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Buscar por concepto o usuario</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar por concepto..."
                    value={searchMovimientos}
                    onChange={(e) => setSearchMovimientos(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  {searchMovimientos && (
                    <button
                      onClick={() => setSearchMovimientos('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Profesional de Movimientos */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {movementError && (
              <div className="m-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>{movementError}</span>
              </div>
            )}

            {loadingMovimientos ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            ) : filteredMovimientos.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ReceiptText size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-foreground">No hay movimientos registrados</p>
                <p className="text-xs mt-1">Selecciona otra caja o cambia los filtros de búsqueda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-left">
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Tipo</th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Fecha / Hora</th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Concepto / Detalle</th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Usuario</th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase text-right">Monto</th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground text-xs uppercase text-right">Saldo Resultante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMovimientos.map((mov) => {
                      const isIngreso = mov.tipoMovimiento === 'INGRESO';
                      return (
                        <tr key={mov.idMovimiento} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                isIngreso
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : 'bg-rose-500/15 text-rose-600'
                              }`}
                            >
                              {isIngreso ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                              {mov.tipoMovimiento}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {dateTime(mov.fechaHora)}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {mov.concepto}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-muted-foreground">
                            {mov.username}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${isIngreso ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isIngreso ? '+' : '-'}{money(mov.monto)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                            {money(mov.saldoActualCajaChica)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación de Movimientos */}
            {movementTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
                <span>Página {movementPage + 1} de {movementTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMovementPage((current) => Math.max(0, current - 1))}
                    disabled={movementPage === 0}
                    className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors text-xs font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setMovementPage((current) => Math.min(movementTotalPages - 1, current + 1))}
                    disabled={movementPage >= movementTotalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors text-xs font-medium"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR CAJA CHICA ───────────────────────── */}
      {showCajaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCajaModal();
          }}
        >
          <form
            onSubmit={handleCajaSubmit}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <h3 className="text-lg font-bold text-foreground">
                {editTarget ? 'Editar Caja Chica' : 'Nueva Caja Chica'}
              </h3>
              <button type="button" onClick={closeCajaModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {cajaFormError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{cajaFormError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Nombre de la Caja <span className="text-rose-500">*</span></label>
                <input
                  value={cajaForm.nombre}
                  onChange={(event) => setCajaForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: Caja Chica Administración / Recepción"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Responsable / Encargado <span className="text-rose-500">*</span></label>
                <input
                  value={cajaForm.responsable}
                  onChange={(event) => setCajaForm((current) => ({ ...current, responsable: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: María Rodríguez"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Saldo Inicial <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cajaForm.saldoActual}
                    onChange={(event) => setCajaForm((current) => ({ ...current, saldoActual: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Límite Aprobado <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={cajaForm.limiteMonto}
                    onChange={(event) => setCajaForm((current) => ({ ...current, limiteMonto: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4 bg-muted/20">
              <button
                type="button"
                onClick={closeCajaModal}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCaja}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
              >
                {savingCaja && <Loader2 size={16} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: REGISTRAR MOVIMIENTO ───────────────────────────── */}
      {showMovimientoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMovimientoModal();
          }}
        >
          <form
            onSubmit={handleMovimientoSubmit}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div>
                <h3 className="text-lg font-bold text-foreground">Registrar Movimiento</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {cajas.find((c) => c.idCajaChica === movimientoForm.idCajaChica)?.nombre || selectedCaja?.nombre}
                </p>
              </div>
              <button type="button" onClick={closeMovimientoModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {movimientoFormError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{movimientoFormError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Seleccionar Caja Chica</label>
                <select
                  value={movimientoForm.idCajaChica || ''}
                  onChange={(e) => setMovimientoForm((prev) => ({ ...prev, idCajaChica: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {cajas
                    .filter((c) => c.estado === 'ACTIVO')
                    .map((c) => (
                      <option key={c.idCajaChica} value={c.idCajaChica}>
                        {c.nombre} (Saldo: {money(c.saldoActual)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Tipo de Operación</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['INGRESO', 'EGRESO'] as TipoMovimientoCaja[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setMovimientoForm((current) => ({ ...current, tipoMovimiento: tipo }))}
                      className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold transition-all ${
                        movimientoForm.tipoMovimiento === tipo
                          ? tipo === 'INGRESO'
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-rose-600 bg-rose-600 text-white shadow-sm'
                          : 'border-border bg-background hover:bg-muted text-foreground'
                      }`}
                    >
                      {tipo === 'INGRESO' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
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
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-right font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Concepto / Motivo <span className="text-rose-500">*</span></label>
                <textarea
                  value={movimientoForm.concepto}
                  onChange={(event) => setMovimientoForm((current) => ({ ...current, concepto: event.target.value }))}
                  className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Ej: Compra de material de limpieza para la oficina..."
                  maxLength={255}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4 bg-muted/20">
              <button
                type="button"
                onClick={closeMovimientoModal}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingMovimiento}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
              >
                {savingMovimiento && <Loader2 size={16} className="animate-spin" />}
                Registrar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: CONFIRMAR DESACTIVACIÓN ─────────────────────────── */}
      {confirmDeactivateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Desactivar Caja Chica</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Esto cambiará el estado a <span className="font-bold text-rose-600">INACTIVO</span> y bloqueará la creación de nuevos movimientos de ingreso o egreso.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors shadow-sm"
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
