import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Loader2, Plus, Search, X, Lock, Unlock, Wallet } from 'lucide-react';
import { cajasApi, turnosCajaApi, Caja, TurnoCaja, CuadreTurnoCaja } from '../../imports/api';

const PAGE_SIZE = 20;

const fmtMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value ?? 0);

const fmtDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '-';

export default function TurnosCaja() {
  const [turnos, setTurnos] = useState<TurnoCaja[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [turnoActual, setTurnoActual] = useState<TurnoCaja | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeTarget, setCloseTarget] = useState<TurnoCaja | null>(null);
  const [cuadrePreview, setCuadrePreview] = useState<CuadreTurnoCaja | null>(null);
  const [loadingCuadre, setLoadingCuadre] = useState(false);
  const [openForm, setOpenForm] = useState({ idCaja: '', montoInicial: '', observacionApertura: '' });
  const [closeForm, setCloseForm] = useState({ montoFinalDeclarado: '', observacionCierre: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchTurnos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [turnosData, cajasData] = await Promise.all([
        turnosCajaApi.listar(page, PAGE_SIZE),
        cajasApi.listarActivas(0, 100),
      ]);

      setTurnos(turnosData.content);
      setTotalPages(turnosData.totalPages);
      setTotalElements(turnosData.totalElements);
      setCajas(cajasData.content);

      try {
        setTurnoActual(await turnosCajaApi.abiertoActual());
      } catch {
        setTurnoActual(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar turnos de caja');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchTurnos(); }, [fetchTurnos]);

  const openApertura = () => {
    setFormError('');
    setOpenForm({ idCaja: cajas[0]?.idCaja ? String(cajas[0].idCaja) : '', montoInicial: '', observacionApertura: '' });
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
      setFormError(err.message || 'Error al calcular cuadre');
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
    const montoInicial = Number(openForm.montoInicial);
    if (!idCaja) { setFormError('Selecciona una caja'); return; }
    if (Number.isNaN(montoInicial) || montoInicial < 0) { setFormError('Monto inicial inválido'); return; }

    setSaving(true);
    setFormError('');
    try {
      await turnosCajaApi.abrir({
        idCaja,
        montoInicial,
        observacionApertura: openForm.observacionApertura.trim() || undefined,
      });
      closeModals();
      fetchTurnos();
    } catch (err: any) {
      setFormError(err.message || 'Error al abrir turno');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async () => {
    if (!closeTarget) return;
    const montoFinalDeclarado = Number(closeForm.montoFinalDeclarado);
    if (Number.isNaN(montoFinalDeclarado) || montoFinalDeclarado < 0) {
      setFormError('Monto final inválido');
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
      setFormError(err.message || 'Error al cerrar turno');
    } finally {
      setSaving(false);
    }
  };

  const filtered = turnos.filter(turno =>
    turno.cajaNombre.toLowerCase().includes(search.toLowerCase()) ||
    turno.usernameUsuarioApertura.toLowerCase().includes(search.toLowerCase()) ||
    (turno.usernameUsuarioCierre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const abiertosEnPagina = turnos.filter(turno => turno.estado === 'ABIERTO').length;
  const montoDeclaradoPreview = Number(closeForm.montoFinalDeclarado);
  const diferenciaPreview = cuadrePreview && closeForm.montoFinalDeclarado.trim() !== '' && !Number.isNaN(montoDeclaradoPreview)
    ? montoDeclaradoPreview - cuadrePreview.montoEsperado
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard size={26} className="text-primary" />
            Turnos de Caja
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalElements} turno{totalElements !== 1 ? 's' : ''} registrado{totalElements !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="btn-abrir-turno"
          onClick={openApertura}
          disabled={cajas.length === 0 || !!turnoActual}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
        >
          <Plus size={18} />
          Abrir Turno
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Turno Actual</p>
              <p className="text-xl mt-1">{turnoActual ? turnoActual.cajaNombre : 'Sin turno'}</p>
            </div>
            <div className="w-11 h-11 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              {turnoActual ? <Unlock size={22} /> : <Lock size={22} />}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Abiertos en lista</p>
              <p className="text-xl mt-1">{abiertosEnPagina}</p>
            </div>
            <div className="w-11 h-11 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <CreditCard size={22} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Monto Inicial Actual</p>
              <p className="text-xl mt-1">{fmtMoney(turnoActual?.montoEsperado ?? turnoActual?.montoInicial)}</p>
            </div>
            <div className="w-11 h-11 bg-blue-500 rounded-lg flex items-center justify-center text-white">
              <Wallet size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por caja o usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No se encontraron turnos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Turno</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Caja</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Apertura</th>
                <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Cierre</th>
                <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Cuadre</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="px-5 py-3 text-center font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(turno => (
                <tr key={turno.idTurnoCaja} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-primary">T-{String(turno.idTurnoCaja).padStart(6, '0')}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{turno.cajaNombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div>{turno.usernameUsuarioApertura}</div>
                    <div className="text-xs">{fmtDate(turno.fechaApertura)}</div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div>{turno.usernameUsuarioCierre ?? '-'}</div>
                    <div className="text-xs">{fmtDate(turno.fechaCierre)}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="font-medium">{fmtMoney(turno.montoEsperado)}</div>
                    <div className={`text-xs ${
                      turno.diferencia === null
                        ? 'text-muted-foreground'
                        : turno.diferencia === 0
                        ? 'text-green-600'
                        : 'text-rose-600'
                    }`}>
                      {turno.diferencia === null ? 'Sin declarar' : fmtMoney(turno.diferencia)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      turno.estado === 'ABIERTO'
                        ? 'bg-green-500/15 text-green-600'
                        : 'bg-slate-500/15 text-slate-600'
                    }`}>
                      {turno.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <button
                        id={`btn-cerrar-turno-${turno.idTurnoCaja}`}
                        onClick={() => openCierre(turno)}
                        disabled={turno.estado !== 'ABIERTO'}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        Cerrar
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
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
              Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Abrir Turno</h3>
              <button onClick={closeModals} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Caja</label>
                <select
                  value={openForm.idCaja}
                  onChange={e => setOpenForm(f => ({ ...f, idCaja: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {cajas.map(caja => <option key={caja.idCaja} value={caja.idCaja}>{caja.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Monto Inicial</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openForm.montoInicial}
                  onChange={e => setOpenForm(f => ({ ...f, montoInicial: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Observación</label>
                <textarea
                  value={openForm.observacionApertura}
                  onChange={e => setOpenForm(f => ({ ...f, observacionApertura: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              {formError && <div className="text-sm text-rose-600 bg-rose-500/10 px-3 py-2 rounded-lg">{formError}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button onClick={closeModals} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleAbrir} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Cerrar Turno</h3>
              <button onClick={closeModals} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="font-medium text-foreground">{closeTarget.cajaNombre}</div>
                <div className="text-muted-foreground">{closeTarget.usernameUsuarioApertura} · {fmtDate(closeTarget.fechaApertura)}</div>
                <div className="text-muted-foreground">Inicial: {fmtMoney(closeTarget.montoInicial)}</div>
              </div>

              <div className="rounded-lg border border-border p-3 text-sm space-y-2">
                {loadingCuadre ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Calculando cuadre...
                  </div>
                ) : cuadrePreview ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Ventas efectivo</p>
                        <p className="font-medium">{fmtMoney(cuadrePreview.totalVentasEfectivo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ventas tarjeta</p>
                        <p className="font-medium">{fmtMoney(cuadrePreview.totalVentasTarjeta)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Otros ingresos</p>
                        <p className="font-medium">{fmtMoney(cuadrePreview.totalOtrosIngresos)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Egresos</p>
                        <p className="font-medium">{fmtMoney(cuadrePreview.totalEgresos)}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-muted-foreground">Efectivo esperado</span>
                      <span className="font-bold text-foreground">{fmtMoney(cuadrePreview.montoEsperado)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Cuadre no disponible</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Monto Final Declarado</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closeForm.montoFinalDeclarado}
                  onChange={e => setCloseForm(f => ({ ...f, montoFinalDeclarado: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {diferenciaPreview !== null && (
                <div className={`rounded-lg px-3 py-2 text-sm border ${
                  diferenciaPreview === 0
                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  Diferencia: {fmtMoney(diferenciaPreview)}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Observación</label>
                <textarea
                  value={closeForm.observacionCierre}
                  onChange={e => setCloseForm(f => ({ ...f, observacionCierre: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              {formError && <div className="text-sm text-rose-600 bg-rose-500/10 px-3 py-2 rounded-lg">{formError}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button onClick={closeModals} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleCerrar} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
