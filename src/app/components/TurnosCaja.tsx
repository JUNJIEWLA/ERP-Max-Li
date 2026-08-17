import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard, Loader2, Plus, Search, X, Lock, Unlock, Wallet,
  Calendar, Filter, RotateCcw, User, Building2, TrendingUp,
  AlertTriangle, CheckCircle2, Eye, Banknote, ArrowUpDown, ChevronLeft, ChevronRight,
  PieChart as PieChartIcon, BarChart2, ShieldCheck, DollarSign
} from 'lucide-react';
import { cajasApi, turnosCajaApi, usuariosApi, Caja, TurnoCaja, CuadreTurnoCaja, Usuario } from '../../imports/api';

const PAGE_SIZE = 20;

const fmtMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value ?? 0);

const fmtDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '-';

interface TurnosCajaProps {
  username: string;
  userPermisos: string[];
}

export default function TurnosCaja({ username, userPermisos }: TurnosCajaProps) {
  const canManageTurnos = userPermisos.includes('CAJA_GESTIONAR');
  const canAssignOthers = canManageTurnos && userPermisos.includes('USUARIO_GESTIONAR');
  // ── State Principal ─────────────────────────────────────────────
  const [turnos, setTurnos] = useState<TurnoCaja[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [turnoActual, setTurnoActual] = useState<TurnoCaja | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [error, setError] = useState('');

  // ── State Filtros Avanzados ──────────────────────────────────────
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroCaja, setFiltroCaja] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroSoloDescuadres, setFiltroSoloDescuadres] = useState(false);

  // ── State Modales y Drawer ───────────────────────────────────────
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedAuditTurno, setSelectedAuditTurno] = useState<TurnoCaja | null>(null);
  
  const [closeTarget, setCloseTarget] = useState<TurnoCaja | null>(null);
  const [cuadrePreview, setCuadrePreview] = useState<CuadreTurnoCaja | null>(null);
  const [loadingCuadre, setLoadingCuadre] = useState(false);
  
  const [openForm, setOpenForm] = useState({ idCaja: '', idUsuario: '', montoInicial: '', observacionApertura: '' });
  const [closeForm, setCloseForm] = useState({ montoFinalDeclarado: '', observacionCierre: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Cargar Datos de Backend ───────────────────────────────────────
  const fetchTurnos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [turnosData, cajasData, usuariosData] = await Promise.all([
        turnosCajaApi.listar(page, PAGE_SIZE),
        cajasApi.listarActivas(0, 100),
        canAssignOthers ? usuariosApi.listarActivos(0, 100) : Promise.resolve(null),
      ]);

      setTurnos(turnosData.content);
      setTotalPages(turnosData.totalPages);
      setTotalElements(turnosData.totalElements);
      setCajas(cajasData.content);
      setUsuarios(usuariosData?.content ?? []);

      try {
        setTurnoActual(await turnosCajaApi.abiertoActual());
      } catch {
        setTurnoActual(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los turnos de caja');
    } finally {
      setLoading(false);
    }
  }, [page, canAssignOthers]);

  useEffect(() => { fetchTurnos(); }, [fetchTurnos]);

  // ── Filtrado Local ───────────────────────────────────────────────
  const filteredTurnos = useMemo(() => {
    return turnos.filter((t) => {
      // Búsqueda por texto (Caja, Cajeros, ID)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesCaja = t.cajaNombre.toLowerCase().includes(q);
        const matchesApertura = t.usernameUsuarioApertura.toLowerCase().includes(q);
        const matchesCierre = (t.usernameUsuarioCierre ?? '').toLowerCase().includes(q);
        const matchesId = String(t.idTurnoCaja).includes(q);
        if (!matchesCaja && !matchesApertura && !matchesCierre && !matchesId) return false;
      }

      // Filtro por Estado
      if (filtroEstado !== 'TODOS' && t.estado !== filtroEstado) return false;

      // Filtro por Caja
      if (filtroCaja && String(t.idCaja) !== filtroCaja) return false;

      // Filtro por Usuario (Apertura o Cierre)
      if (filtroUsuario && String(t.idUsuarioApertura) !== filtroUsuario && String(t.idUsuarioCierre) !== filtroUsuario) {
        return false;
      }

      // Filtro Solo Descuadres
      if (filtroSoloDescuadres) {
        if (t.diferencia === null || t.diferencia === 0) return false;
      }

      // Filtro por Rango de Fechas (Apertura)
      if (fechaDesde) {
        const fApertura = new Date(t.fechaApertura).toISOString().split('T')[0];
        if (fApertura < fechaDesde) return false;
      }

      if (fechaHasta) {
        const fApertura = new Date(t.fechaApertura).toISOString().split('T')[0];
        if (fApertura > fechaHasta) return false;
      }

      return true;
    });
  }, [turnos, search, filtroEstado, filtroCaja, filtroUsuario, filtroSoloDescuadres, fechaDesde, fechaHasta]);

  // ── Cálculo de KPIs y Totales ────────────────────────────────────
  const kpis = useMemo(() => {
    let totalRecaudado = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalEgresos = 0;
    let totalDescuadres = 0;
    let turnosDescuadradosCount = 0;
    let turnosAbiertosCount = 0;

    filteredTurnos.forEach((t) => {
      const efectivo = t.totalVentasEfectivo || 0;
      const tarjeta = t.totalVentasTarjeta || 0;
      const transferencia = t.totalVentasTransferencia || 0;
      const egresos = t.totalEgresos || 0;

      totalEfectivo += efectivo;
      totalTarjeta += tarjeta;
      totalTransferencia += transferencia;
      totalEgresos += egresos;
      totalRecaudado += (efectivo + tarjeta + transferencia);

      if (t.estado === 'ABIERTO') {
        turnosAbiertosCount++;
      }

      if (t.diferencia !== null && t.diferencia !== 0) {
        totalDescuadres += Math.abs(t.diferencia);
        turnosDescuadradosCount++;
      }
    });

    return {
      totalRecaudado,
      totalEfectivo,
      totalTarjeta,
      totalTransferencia,
      totalEgresos,
      totalDescuadres,
      turnosDescuadradosCount,
      turnosAbiertosCount,
      count: filteredTurnos.length,
    };
  }, [filteredTurnos]);

  // Limpiar Filtros
  const handleLimpiarFiltros = () => {
    setSearch('');
    setFechaDesde('');
    setFechaHasta('');
    setFiltroUsuario('');
    setFiltroCaja('');
    setFiltroEstado('TODOS');
    setFiltroSoloDescuadres(false);
  };

  // ── Manejo de Apertura y Cierre ──────────────────────────────────
  const openApertura = () => {
    setFormError('');
    const matchUser = usuarios.find(u => u.username === username);
    const initialUserId = canAssignOthers
      ? (matchUser ? String(matchUser.idUsuario) : (usuarios[0]?.idUsuario ? String(usuarios[0].idUsuario) : ''))
      : '';

    setOpenForm({
      idCaja: cajas[0]?.idCaja ? String(cajas[0].idCaja) : '',
      idUsuario: initialUserId,
      montoInicial: '',
      observacionApertura: '',
    });
    setShowOpenModal(true);
  };

  const openCierre = async (turno: TurnoCaja) => {
    setFormError('');
    setCloseTarget(turno);
    setCuadrePreview(null);
    setCloseForm({ montoFinalDeclarado: '', observacionCierre: '' });
    setShowCloseModal(true);
    setLoadingCuadre(true);
    try {
      setCuadrePreview(await turnosCajaApi.calcularCuadre(turno.idTurnoCaja));
    } catch (err: any) {
      setFormError(err.message || 'Error al calcular el cuadre de caja');
    } finally {
      setLoadingCuadre(false);
    }
  };

  const closeModals = () => {
    setShowOpenModal(false);
    setShowCloseModal(false);
    setCloseTarget(null);
    setCuadrePreview(null);
    setLoadingCuadre(false);
    setSaving(false);
    setFormError('');
  };

  const handleAbrir = async () => {
    const idCaja = Number(openForm.idCaja);
    const idUsuario = canAssignOthers && openForm.idUsuario ? Number(openForm.idUsuario) : undefined;
    const montoInicial = Number(openForm.montoInicial || 0);

    if (!idCaja) { setFormError('Debes seleccionar una caja física.'); return; }
    if (Number.isNaN(montoInicial) || montoInicial < 0) { setFormError('El monto inicial debe ser válido (≥ 0).'); return; }

    setSaving(true);
    setFormError('');
    try {
      await turnosCajaApi.abrir({
        idCaja,
        idUsuario,
        montoInicial,
        observacionApertura: openForm.observacionApertura.trim() || undefined,
      });
      closeModals();
      fetchTurnos();
    } catch (err: any) {
      setFormError(err.message || 'Error al abrir el turno');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async () => {
    if (!closeTarget) return;
    const montoFinalDeclarado = Number(closeForm.montoFinalDeclarado);
    if (Number.isNaN(montoFinalDeclarado) || montoFinalDeclarado < 0) {
      setFormError('El monto final declarado debe ser un número válido ≥ 0');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await turnosCajaApi.cerrar(closeTarget.idTurnoCaja, {
        montoFinalDeclarado,
        observacionCierre: closeForm.observacionCierre.trim() || undefined,
      });
      closeModals();
      fetchTurnos();
    } catch (err: any) {
      setFormError(err.message || 'Error al cerrar el turno');
    } finally {
      setSaving(false);
    }
  };

  const montoDeclaradoPreview = Number(closeForm.montoFinalDeclarado);
  const diferenciaPreview = cuadrePreview && closeForm.montoFinalDeclarado.trim() !== '' && !Number.isNaN(montoDeclaradoPreview)
    ? montoDeclaradoPreview - cuadrePreview.montoEsperado
    : null;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      
      {/* Header y Acción Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-card via-card/80 to-card/50 p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-2xl border border-blue-500/20">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Gestión de Turnos de Caja (CashShift)
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supervisión de cierres, auditoría de cuadres y recaudación en efectivo y tarjeta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTurnos}
            className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Recargar datos"
          >
            <RotateCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            id="btn-abrir-turno"
            onClick={openApertura}
            disabled={cajas.length === 0 || !!turnoActual}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-all font-semibold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Abrir Nuevo Turno
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Recaudación Total */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recaudación Filtrada</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground font-mono">
              {fmtMoney(kpis.totalRecaudado)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>{kpis.count} turno{kpis.count !== 1 ? 's' : ''} en consulta</span>
            </p>
          </div>
        </div>

        {/* KPI 2: Desglose Efectivo vs Tarjeta */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Desglose de Métodos</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Efectivo:
              </span>
              <span className="font-semibold text-foreground font-mono">{fmtMoney(kpis.totalEfectivo)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Tarjeta:
              </span>
              <span className="font-semibold text-foreground font-mono">{fmtMoney(kpis.totalTarjeta)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Transf:
              </span>
              <span className="font-semibold text-foreground font-mono">{fmtMoney(kpis.totalTransferencia)}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Turnos Abiertos */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Turnos Activos</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <Unlock size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground flex items-center gap-2">
              <span>{kpis.turnosAbiertosCount}</span>
              {kpis.turnosAbiertosCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  En servicio
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {turnoActual ? `Caja activa: ${turnoActual.cajaNombre}` : 'Sin turno activo en esta sesión'}
            </p>
          </div>
        </div>

        {/* KPI 4: Descuadres / Arqueo */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auditoría de Arqueo</span>
            <div className={`p-2 rounded-xl ${kpis.turnosDescuadradosCount > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
              {kpis.turnosDescuadradosCount > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            </div>
          </div>
          <div>
            <div className={`text-2xl font-extrabold font-mono ${kpis.turnosDescuadradosCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {kpis.turnosDescuadradosCount > 0 ? fmtMoney(kpis.totalDescuadres) : 'RD$ 0.00'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {kpis.turnosDescuadradosCount > 0
                ? `${kpis.turnosDescuadradosCount} turno${kpis.turnosDescuadradosCount !== 1 ? 's' : ''} con descuadre`
                : 'Cierres de caja totalmente cuadrados'}
            </p>
          </div>
        </div>
      </div>

      {/* Gráfica Visual y Distribución por Métodos de Pago */}
      {kpis.totalRecaudado > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <PieChartIcon size={18} className="text-blue-600" />
              Distribución de Métodos de Pago en Turnos Consultados
            </h3>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              Total: {fmtMoney(kpis.totalRecaudado)}
            </span>
          </div>

          {/* Segment Bar Breakdown Visual */}
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
              {kpis.totalEfectivo > 0 && (
                <div
                  style={{ width: `${(kpis.totalEfectivo / kpis.totalRecaudado) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`Efectivo: ${fmtMoney(kpis.totalEfectivo)}`}
                />
              )}
              {kpis.totalTarjeta > 0 && (
                <div
                  style={{ width: `${(kpis.totalTarjeta / kpis.totalRecaudado) * 100}%` }}
                  className="bg-blue-600 transition-all duration-500"
                  title={`Tarjeta: ${fmtMoney(kpis.totalTarjeta)}`}
                />
              )}
              {kpis.totalTransferencia > 0 && (
                <div
                  style={{ width: `${(kpis.totalTransferencia / kpis.totalRecaudado) * 100}%` }}
                  className="bg-purple-600 transition-all duration-500"
                  title={`Transferencia: ${fmtMoney(kpis.totalTransferencia)}`}
                />
              )}
            </div>

            {/* Legend & Percentages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Banknote size={14} /> Efectivo
                </span>
                <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300">
                  {fmtMoney(kpis.totalEfectivo)} ({((kpis.totalEfectivo / kpis.totalRecaudado) * 100).toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <CreditCard size={14} /> Tarjeta
                </span>
                <span className="font-bold font-mono text-blue-800 dark:text-blue-300">
                  {fmtMoney(kpis.totalTarjeta)} ({((kpis.totalTarjeta / kpis.totalRecaudado) * 100).toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <ArrowUpDown size={14} /> Transferencia
                </span>
                <span className="font-bold font-mono text-purple-800 dark:text-purple-300">
                  {fmtMoney(kpis.totalTransferencia)} ({((kpis.totalTransferencia / kpis.totalRecaudado) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros ERP Pro */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter size={16} className="text-blue-600" />
            <span>Filtros Avanzados de Búsqueda</span>
          </div>
          {(search || fechaDesde || fechaHasta || filtroUsuario || filtroCaja || filtroEstado !== 'TODOS' || filtroSoloDescuadres) && (
            <button
              onClick={handleLimpiarFiltros}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              <X size={14} /> Limpiar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* Búsqueda general */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Buscar por Turno / Caja / Usuario</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ej: Turno #1, Caja 01, juan.perez..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar size={13} /> Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar size={13} /> Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Filtro por Usuario */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <User size={13} /> Cajero / Usuario
            </label>
            <select
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option key={u.idUsuario} value={u.idUsuario}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Caja */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Building2 size={13} /> Caja Registradora
            </label>
            <select
              value={filtroCaja}
              onChange={(e) => setFiltroCaja(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Todas las cajas</option>
              {cajas.map((c) => (
                <option key={c.idCaja} value={c.idCaja}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            {/* Filtro de Estado */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Estado:</span>
              {['TODOS', 'ABIERTO', 'CERRADO'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFiltroEstado(st)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    filtroEstado === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Toggle Solo Descuadres */}
            <button
              onClick={() => setFiltroSoloDescuadres(!filtroSoloDescuadres)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                filtroSoloDescuadres
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <AlertTriangle size={13} />
              Solo con Descuadre
            </button>
          </div>

          <span className="text-xs text-muted-foreground">
            Mostrando <strong>{filteredTurnos.length}</strong> de <strong>{totalElements}</strong> turnos
          </span>
        </div>
      </div>

      {/* Tabla Enterprise Rediseñada */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-xs text-muted-foreground">Cargando auditoría de turnos...</p>
          </div>
        ) : filteredTurnos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <Wallet size={48} className="mx-auto opacity-30 text-muted-foreground" />
            <p className="font-semibold text-base text-foreground">No se encontraron turnos con los filtros aplicados</p>
            <button onClick={handleLimpiarFiltros} className="text-xs text-blue-600 hover:underline">
              Limpiar filtros de búsqueda
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID / Turno</th>
                  <th className="px-5 py-3.5">Caja Registradora</th>
                  <th className="px-5 py-3.5">Cajero Apertura</th>
                  <th className="px-5 py-3.5">Cajero Cierre</th>
                  <th className="px-5 py-3.5 text-right">Fondo Inicial</th>
                  <th className="px-5 py-3.5 text-right">Ventas Totales</th>
                  <th className="px-5 py-3.5 text-right">Esperado / Declarado</th>
                  <th className="px-5 py-3.5 text-center">Diferencia / Arqueo</th>
                  <th className="px-5 py-3.5 text-center">Estado</th>
                  <th className="px-5 py-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTurnos.map((t) => {
                  const totalVentasTurno = (t.totalVentasEfectivo || 0) + (t.totalVentasTarjeta || 0) + (t.totalVentasTransferencia || 0);

                  return (
                    <tr key={t.idTurnoCaja} className="hover:bg-muted/40 transition-colors group">
                      
                      {/* ID Turno */}
                      <td className="px-5 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        #TRN-{String(t.idTurnoCaja).padStart(5, '0')}
                      </td>

                      {/* Caja */}
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 size={15} className="text-muted-foreground" />
                          <span>{t.cajaNombre}</span>
                        </div>
                      </td>

                      {/* Cajero Apertura */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 font-bold flex items-center justify-center text-[10px]">
                            {t.usernameUsuarioApertura.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{t.usernameUsuarioApertura}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtDate(t.fechaApertura)}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cajero Cierre */}
                      <td className="px-5 py-4">
                        {t.usernameUsuarioCierre ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 font-bold flex items-center justify-center text-[10px]">
                              {t.usernameUsuarioCierre.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{t.usernameUsuarioCierre}</div>
                              <div className="text-[10px] text-muted-foreground">{fmtDate(t.fechaCierre)}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">- En proceso -</span>
                        )}
                      </td>

                      {/* Fondo Inicial */}
                      <td className="px-5 py-4 text-right font-mono font-medium text-foreground">
                        {fmtMoney(t.montoInicial)}
                      </td>

                      {/* Ventas Totales */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtMoney(totalVentasTurno)}
                      </td>

                      {/* Esperado / Declarado */}
                      <td className="px-5 py-4 text-right font-mono">
                        <div className="text-foreground font-semibold">Esp: {fmtMoney(t.montoEsperado)}</div>
                        <div className="text-muted-foreground text-[11px]">
                          Dec: {t.montoFinalDeclarado !== null ? fmtMoney(t.montoFinalDeclarado) : 'Pendiente'}
                        </div>
                      </td>

                      {/* Diferencia / Arqueo */}
                      <td className="px-5 py-4 text-center font-mono">
                        {t.diferencia === null ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground font-medium">
                            En curso
                          </span>
                        ) : t.diferencia === 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Cuadrado
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            t.diferencia < 0
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          }`}>
                            {t.diferencia < 0 ? `Faltante: ${fmtMoney(t.diferencia)}` : `Sobrante: ${fmtMoney(t.diferencia)}`}
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                          t.estado === 'ABIERTO'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                        }`}>
                          {t.estado === 'ABIERTO' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                          {t.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botón Ver Detalle Auditoría */}
                          <button
                            onClick={() => setSelectedAuditTurno(t)}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver desglose contable"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Botón Cerrar Turno */}
                          {t.estado === 'ABIERTO' && (canManageTurnos || t.usernameUsuarioApertura === username) && (
                            <button
                              id={`btn-cerrar-turno-${t.idTurnoCaja}`}
                              onClick={() => openCierre(t)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all text-[11px] font-semibold shadow-sm"
                            >
                              Cerrar
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
        )}

        {/* Paginación Numérica */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Página <strong className="text-foreground">{page + 1}</strong> de <strong className="text-foreground">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-medium transition-all ${
                      page === pageNum
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : 'border border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Drawer / Modal Auditoría de Turno */}
      {selectedAuditTurno && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border h-full max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/10 via-primary/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Auditoría de Turno #TRN-{String(selectedAuditTurno.idTurnoCaja).padStart(5, '0')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Desglose de recaudación, arqueo de caja y comprobantes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditTurno(null)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* Información General */}
              <div className="grid grid-cols-2 gap-3 bg-muted/40 p-4 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground">Terminal Física:</span>
                  <p className="font-bold text-foreground text-sm mt-0.5">{selectedAuditTurno.cajaNombre}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado del Turno:</span>
                  <p className="font-bold text-foreground mt-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                      selectedAuditTurno.estado === 'ABIERTO' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-600'
                    }`}>
                      {selectedAuditTurno.estado}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Apertura:</span>
                  <p className="font-semibold text-foreground">{selectedAuditTurno.usernameUsuarioApertura}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(selectedAuditTurno.fechaApertura)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cierre:</span>
                  <p className="font-semibold text-foreground">{selectedAuditTurno.usernameUsuarioCierre || '-'}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(selectedAuditTurno.fechaCierre)}</p>
                </div>
              </div>

              {/* Desglose de Recaudación */}
              <div className="space-y-2">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground">
                  Desglose por Métodos de Pago
                </h4>
                <div className="space-y-2 bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Fondo de Caja (Monto Inicial):</span>
                    <span className="font-mono font-semibold text-foreground">{fmtMoney(selectedAuditTurno.montoInicial)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Banknote size={14} className="text-emerald-600" /> Ventas en Efectivo:
                    </span>
                    <span className="font-mono font-semibold text-emerald-600">{fmtMoney(selectedAuditTurno.totalVentasEfectivo)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CreditCard size={14} className="text-blue-600" /> Ventas con Tarjeta:
                    </span>
                    <span className="font-mono font-semibold text-blue-600">{fmtMoney(selectedAuditTurno.totalVentasTarjeta)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ArrowUpDown size={14} className="text-purple-600" /> Ventas por Transferencia:
                    </span>
                    <span className="font-mono font-semibold text-purple-600">{fmtMoney(selectedAuditTurno.totalVentasTransferencia)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Otros Ingresos:</span>
                    <span className="font-mono font-semibold text-foreground">{fmtMoney(selectedAuditTurno.totalOtrosIngresos)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Egresos / Salidas de Caja:</span>
                    <span className="font-mono font-semibold text-rose-600">-{fmtMoney(selectedAuditTurno.totalEgresos)}</span>
                  </div>
                </div>
              </div>

              {/* Resultado de Arqueo */}
              <div className="space-y-2">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground">
                  Resultado Contable de Arqueo
                </h4>
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2.5">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span>Monto Esperado en Efectivo:</span>
                    <span className="font-mono text-foreground font-bold">{fmtMoney(selectedAuditTurno.montoEsperado)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span>Monto Final Declarado:</span>
                    <span className="font-mono text-foreground font-bold">
                      {selectedAuditTurno.montoFinalDeclarado !== null ? fmtMoney(selectedAuditTurno.montoFinalDeclarado) : 'Sin declarar'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between items-center">
                    <span className="font-bold text-foreground">Diferencia (Descuadre):</span>
                    <span className={`font-mono font-extrabold text-sm ${
                      selectedAuditTurno.diferencia === null
                        ? 'text-muted-foreground'
                        : selectedAuditTurno.diferencia === 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}>
                      {selectedAuditTurno.diferencia === null ? 'Pendiente' : fmtMoney(selectedAuditTurno.diferencia)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {(selectedAuditTurno.observacionApertura || selectedAuditTurno.observacionCierre) && (
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground">
                    Observaciones Registradas
                  </h4>
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2 text-xs">
                    {selectedAuditTurno.observacionApertura && (
                      <div>
                        <span className="font-semibold text-foreground">Apertura: </span>
                        <span className="text-muted-foreground">{selectedAuditTurno.observacionApertura}</span>
                      </div>
                    )}
                    {selectedAuditTurno.observacionCierre && (
                      <div>
                        <span className="font-semibold text-foreground">Cierre: </span>
                        <span className="text-muted-foreground">{selectedAuditTurno.observacionCierre}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => setSelectedAuditTurno(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs"
              >
                Cerrar Auditoría
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Abrir Turno */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Abrir Turno de Caja</h3>
              <button onClick={closeModals} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Caja Registradora Física</label>
                <select
                  value={openForm.idCaja}
                  onChange={(e) => setOpenForm((f) => ({ ...f, idCaja: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {cajas.map((caja) => (
                    <option key={caja.idCaja} value={caja.idCaja}>
                      {caja.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Usuario / Cajero Asignado</label>
                {canAssignOthers ? (
                  <select
                    value={openForm.idUsuario}
                    onChange={(e) => setOpenForm((f) => ({ ...f, idUsuario: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {usuarios.map((u) => (
                      <option key={u.idUsuario} value={u.idUsuario}>
                        {u.username} ({u.email || `ID: #${u.idUsuario}`})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3.5 py-2 rounded-xl border border-border bg-muted/40 text-foreground font-medium">
                    {username}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Fondo de Caja (Monto Inicial DOP)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={openForm.montoInicial}
                  onChange={(e) => setOpenForm((f) => ({ ...f, montoInicial: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Observaciones de Apertura</label>
                <textarea
                  value={openForm.observacionApertura}
                  onChange={(e) => setOpenForm((f) => ({ ...f, observacionApertura: e.target.value }))}
                  rows={2}
                  placeholder="Ej: Verificado con supervisor..."
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>

              {formError && (
                <div className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button onClick={closeModals} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs">
                Cancelar
              </button>
              <button
                onClick={handleAbrir}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-md disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Abrir Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cerrar Turno */}
      {showCloseModal && closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Cerrar Turno de Caja</h3>
              <button onClick={closeModals} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
                <div className="font-bold text-foreground text-sm">{closeTarget.cajaNombre}</div>
                <div className="text-muted-foreground">Cajero: {closeTarget.usernameUsuarioApertura}</div>
                <div className="text-muted-foreground">Fondo Inicial: {fmtMoney(closeTarget.montoInicial)}</div>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-2 bg-card">
                {loadingCuadre ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2 justify-center">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    Calculando cuadre de caja...
                  </div>
                ) : cuadrePreview ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Ventas Efectivo:</span>
                        <p className="font-semibold text-emerald-600 font-mono">{fmtMoney(cuadrePreview.totalVentasEfectivo)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ventas Tarjeta:</span>
                        <p className="font-semibold text-blue-600 font-mono">{fmtMoney(cuadrePreview.totalVentasTarjeta)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Otros Ingresos:</span>
                        <p className="font-semibold font-mono">{fmtMoney(cuadrePreview.totalOtrosIngresos)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Egresos:</span>
                        <p className="font-semibold text-rose-600 font-mono">-{fmtMoney(cuadrePreview.totalEgresos)}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex justify-between items-center font-semibold text-sm">
                      <span>Efectivo Esperado:</span>
                      <span className="font-bold font-mono text-foreground">{fmtMoney(cuadrePreview.montoEsperado)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Cuadre no disponible</div>
                )}
              </div>

              <div>
                <label htmlFor="input-cierre-monto-declarado" className="block font-semibold text-foreground mb-1">Monto Final Declarado en Efectivo</label>
                <input
                  id="input-cierre-monto-declarado"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={closeForm.montoFinalDeclarado}
                  onChange={(e) => setCloseForm((f) => ({ ...f, montoFinalDeclarado: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {diferenciaPreview !== null && (
                <div className={`rounded-xl px-3.5 py-2.5 font-semibold text-xs border ${
                  diferenciaPreview === 0
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  Diferencia Calculada: {fmtMoney(diferenciaPreview)}
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Observaciones de Cierre</label>
                <textarea
                  value={closeForm.observacionCierre}
                  onChange={(e) => setCloseForm((f) => ({ ...f, observacionCierre: e.target.value }))}
                  rows={2}
                  placeholder="Ej: Cuadre entregado a administración..."
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>

              {formError && (
                <div className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button onClick={closeModals} className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs">
                Cancelar
              </button>
              <button
                onClick={handleCerrar}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold shadow-md disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Confirmar Cierre de Caja
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
