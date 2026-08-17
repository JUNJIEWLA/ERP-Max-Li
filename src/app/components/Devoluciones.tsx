import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Eye, Loader2, Plus, RotateCcw, Search, Undo2, X,
} from 'lucide-react';
import {
  ApiError, devolucionesApi, turnosCajaApi, ventasApi,
  type DevolucionResponse, type DevolucionResumen,
  type TurnoCaja, type VentaDevoluble, type VentaResumen,
} from '../../imports/api';

// ── Formato ──────────────────────────────────────────────

const monedaDO = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });

const fmtMoneda = (v: number | null | undefined) => monedaDO.format(v ?? 0);

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/** Una venta sin cliente identificado es, fiscalmente, consumidor final. */
const nombreCliente = (nombre: string | null) => nombre || 'Consumidor Final';

/**
 * Las devoluciones nuevas siempre acreditan Nota de Crédito, pero el historial
 * anterior a esa política conserva el método con el que se reembolsó de verdad.
 */
const etiquetaReembolso = (metodo: string) =>
  metodo === 'NOTA_CREDITO' ? 'Nota de Crédito' : metodo;

const PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────
//  Detalle de una devolución ya registrada
// ─────────────────────────────────────────────────────────

function DetalleDevolucionModal({ idDevolucion, onClose }: { idDevolucion: number; onClose: () => void }) {
  const [devolucion, setDevolucion] = useState<DevolucionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    devolucionesApi.buscarPorId(idDevolucion)
      .then(setDevolucion)
      .catch((e: any) => setError(e.message || 'No se pudo cargar el detalle de la devolución.'))
      .finally(() => setLoading(false));
  }, [idDevolucion]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Undo2 size={17} className="text-amber-600" />
            <h2 className="text-base font-semibold">Detalle de la devolución</h2>
          </div>
          <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        {loading && (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 size={26} className="animate-spin mx-auto mb-2" />
            Cargando el detalle…
          </div>
        )}

        {!loading && error && (
          <div className="p-6 space-y-3">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> {error}
            </div>
            <button
              id="btn-reintentar-detalle-devolucion"
              onClick={cargar}
              className="w-full py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && devolucion && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Nota de crédito</p>
                  <p id="detalle-devolucion-b04" className="font-bold mt-0.5 font-mono">{devolucion.ncf}</p>
                  <p className="text-xs text-muted-foreground">{devolucion.tipoNcf}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">NCF afectado</p>
                  <p id="detalle-devolucion-ncf-afectado" className="font-bold mt-0.5 font-mono">
                    {devolucion.ncfAfectado || 'Sin NCF'}
                  </p>
                  <p className="text-xs text-muted-foreground">{devolucion.tipoNcfAfectado || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">N° devolución</p>
                  <p className="font-bold mt-0.5 font-mono">{devolucion.numeroControl}</p>
                  <p className="text-xs text-muted-foreground">{devolucion.estado}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Venta original</p>
                  <p id="detalle-devolucion-venta" className="font-bold mt-0.5 font-mono">
                    {devolucion.numeroControlVenta}
                  </p>
                  <p className="text-xs text-muted-foreground">{devolucion.estadoVenta}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-semibold mt-0.5">{nombreCliente(devolucion.clienteNombre)}</p>
                  {devolucion.clienteRncCedula && (
                    <p className="text-xs text-muted-foreground">RNC/Cédula: {devolucion.clienteRncCedula}</p>
                  )}
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Cajero</p>
                  <p className="font-semibold mt-0.5">{devolucion.cajeroNombre}</p>
                  <p className="text-xs text-muted-foreground">TURNO #{devolucion.idTurnoCaja}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Almacén</p>
                  <p className="font-semibold mt-0.5">{devolucion.almacenNombre}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-semibold mt-0.5 text-xs">{fmtFechaHora(devolucion.fechaDevolucion)}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="border border-border rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p id="detalle-devolucion-motivo" className="mt-0.5">{devolucion.motivo}</p>
                </div>
                <div className="border border-border rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Método de reembolso</p>
                  <p className="mt-0.5 font-semibold">{etiquetaReembolso(devolucion.metodoReembolso)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Productos acreditados ({devolucion.detalles.length})
                </p>
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Producto</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Cant.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Precio</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Base acred.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">ITBIS acred.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devolucion.detalles.map(d => (
                        <tr key={d.idDetalleDevolucion} className="border-b border-border/50">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.skuProducto}</td>
                          <td className="px-3 py-2">{d.nombreProducto}</td>
                          <td className="px-3 py-2 text-right">{d.cantidad}</td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.precioUnitario)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.baseImponibleAcreditada)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.itbisAcreditado)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmtMoneda(d.importeAcreditado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 text-sm space-y-1 md:max-w-xs md:ml-auto">
                <div className="flex justify-between">
                  <span>Base imponible</span>
                  <span id="detalle-devolucion-base">{fmtMoneda(devolucion.baseImponible)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ITBIS</span>
                  <span id="detalle-devolucion-itbis">{fmtMoneda(devolucion.itbis)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-1 mt-1">
                  <span>Total acreditado</span>
                  <span id="detalle-devolucion-total">{fmtMoneda(devolucion.total)}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <button
                id="btn-cerrar-detalle-devolucion"
                onClick={onClose}
                className="w-full py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Nueva devolución
// ─────────────────────────────────────────────────────────

function NuevaDevolucionModal({ onCerrar, onRefrescar }: {
  /** `true` cuando queda algo nuevo que leer del backend. */
  onCerrar: (refrescarHistorial: boolean) => void;
  onRefrescar: () => void;
}) {
  // Paso 0: turno abierto del usuario. Sin él el backend rechaza el reembolso.
  const [turno, setTurno] = useState<TurnoCaja | null>(null);
  const [turnoError, setTurnoError] = useState<string | null>(null);
  const [cargandoTurno, setCargandoTurno] = useState(true);

  // Paso 1: localizar la venta. La búsqueda la resuelve el backend.
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<VentaResumen[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Paso 2: líneas devolvibles de la venta elegida.
  const [venta, setVenta] = useState<VentaDevoluble | null>(null);
  const [cargandoVenta, setCargandoVenta] = useState(false);
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  // Paso 3: confirmación.
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<{ mensaje: string; yaRegistrada: boolean } | null>(null);
  const [resultado, setResultado] = useState<DevolucionResponse | null>(null);

  /**
   * Llave de idempotencia del intento en curso.
   *
   * Se crea la primera vez que hace falta y sobrevive a los reintentos: si el
   * primer POST se perdió en la red pero el servidor lo procesó, repetirlo con
   * la misma referencia devuelve 409 en lugar de emitir un segundo B04. Solo se
   * descarta al empezar una devolución distinta.
   */
  /**
   * Hay algo confirmado en el servidor que el historial de detrás todavía no
   * refleja. Lo levanta tanto un 201 como un 409 —que significa que la
   * operación ya se registró, quizá en un envío anterior que se perdió— y lo
   * consume una única recarga, salga el usuario por donde salga.
   */
  const debeRefrescar = useRef(false);

  const referenciaRef = useRef<string | null>(null);
  const referenciaDelIntento = () => {
    if (referenciaRef.current === null) {
      referenciaRef.current = crypto.randomUUID();
    }
    return referenciaRef.current;
  };

  const cargarTurno = useCallback(() => {
    setCargandoTurno(true);
    setTurnoError(null);
    turnosCajaApi.abiertoActual()
      .then(setTurno)
      .catch((e: any) => {
        setTurno(null);
        setTurnoError(e.message || 'No tienes un turno de caja abierto: no se puede entregar el reembolso.');
      })
      .finally(() => setCargandoTurno(false));
  }, []);

  useEffect(() => { cargarTurno(); }, [cargarTurno]);

  const buscarVentas = () => {
    const q = busqueda.trim();
    if (!q || buscando) return;
    setBuscando(true);
    setErrorBusqueda(null);
    ventasApi.listar({ q }, 0, 10)
      .then(pagina => setResultados(pagina.content))
      .catch((e: any) => {
        setResultados([]);
        setErrorBusqueda(e.message || 'No se pudo buscar la venta.');
      })
      .finally(() => setBuscando(false));
  };

  const seleccionarVenta = (idVenta: number) => {
    setCargandoVenta(true);
    setErrorVenta(null);
    setVenta(null);
    setCantidades({});
    devolucionesApi.consultarDisponible(idVenta)
      .then(setVenta)
      .catch((e: any) => setErrorVenta(e.message || 'No se pudo consultar lo devolvible de esta venta.'))
      .finally(() => setCargandoVenta(false));
  };

  const volverABuscar = () => {
    setVenta(null);
    setCantidades({});
    setErrorVenta(null);
  };

  const cambiarCantidad = (idDetalleVenta: number, disponible: number, valor: string) => {
    setCantidades(previas => {
      const siguientes = { ...previas };
      const numero = Number.parseInt(valor, 10);
      if (!Number.isFinite(numero) || numero <= 0) {
        delete siguientes[idDetalleVenta];
      } else {
        siguientes[idDetalleVenta] = Math.min(numero, disponible);
      }
      return siguientes;
    });
  };

  const detalles = (venta?.lineas ?? [])
    .filter(linea => (cantidades[linea.idDetalleVenta] ?? 0) > 0)
    .map(linea => ({ idDetalleVenta: linea.idDetalleVenta, cantidad: cantidades[linea.idDetalleVenta] }));

  const unidades = detalles.reduce((suma, linea) => suma + linea.cantidad, 0);

  // Tras un 409 el intento está cerrado: repetirlo con la misma referencia
  // volvería a chocar, y generar otra duplicaría la nota de crédito.
  const puedeConfirmar = !!turno && !!venta && venta.devolvible
    && detalles.length > 0 && motivo.trim().length > 0 && !enviando
    && !errorEnvio?.yaRegistrada;

  const confirmar = () => {
    if (!puedeConfirmar || !turno || !venta) return;
    setEnviando(true);
    setErrorEnvio(null);
    devolucionesApi.crear({
      idVenta: venta.idVenta,
      idTurnoCaja: turno.idTurnoCaja,
      motivo: motivo.trim(),
      metodoReembolso: 'NOTA_CREDITO',
      referenciaOperacion: referenciaDelIntento(),
      detalles,
    })
      .then(devolucion => {
        debeRefrescar.current = true;
        setResultado(devolucion);
      })
      .catch((e: any) => {
        const yaRegistrada = e instanceof ApiError && e.status === 409;
        // El 409 no confirma nada nuevo, pero sí que algo se confirmó antes:
        // el historial es la única forma de saber qué quedó registrado.
        if (yaRegistrada) debeRefrescar.current = true;
        setErrorEnvio({
          mensaje: e.message || 'No se pudo registrar la devolución.',
          yaRegistrada,
        });
      })
      .finally(() => setEnviando(false));
  };

  /** Deja el formulario listo para una devolución distinta, con otra llave. */
  const registrarOtra = () => {
    referenciaRef.current = null;
    setResultado(null);
    setErrorEnvio(null);
    setBusqueda('');
    setResultados(null);
    setVenta(null);
    setCantidades({});
    setMotivo('');
    // El historial de detrás se pone al día aquí y ya no vuelve a pedirse al
    // cerrar: una sola carga por operación registrada.
    if (debeRefrescar.current) {
      debeRefrescar.current = false;
      onRefrescar();
    }
    cargarTurno();
  };

  /** Única salida del modal: la X, el fondo y los botones pasan por aquí. */
  const cerrar = () => onCerrar(debeRefrescar.current);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !enviando) cerrar(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Undo2 size={17} className="text-amber-600" />
            <h2 className="text-base font-semibold">Nueva devolución</h2>
          </div>
          <button
            id="btn-cerrar-modal-devolucion"
            onClick={cerrar}
            disabled={enviando}
            title="Cerrar"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Resultado del servidor ─────────────────────── */}
        {resultado ? (
          <>
            <div id="resultado-devolucion" className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 size={17} />
                <span>
                  Devolución <span className="font-mono font-semibold">{resultado.numeroControl}</span> registrada.
                  La venta {resultado.numeroControlVenta} quedó {resultado.estadoVenta}.
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Nota de crédito</p>
                  <p id="resultado-b04" className="font-bold mt-0.5 font-mono">{resultado.ncf}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">NCF afectado</p>
                  <p id="resultado-ncf-afectado" className="font-bold mt-0.5 font-mono">
                    {resultado.ncfAfectado || 'Sin NCF'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Base imponible</p>
                  <p id="resultado-base" className="font-semibold mt-0.5">{fmtMoneda(resultado.baseImponible)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">ITBIS</p>
                  <p id="resultado-itbis" className="font-semibold mt-0.5">{fmtMoneda(resultado.itbis)}</p>
                </div>
              </div>

              <div className="border border-border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total acreditado</p>
                  <p id="resultado-total" className="text-lg font-bold">{fmtMoneda(resultado.total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">A reembolsar al cliente</p>
                  <p id="resultado-reembolso" className="font-semibold">
                    {fmtMoneda(resultado.total)} en {etiquetaReembolso(resultado.metodoReembolso)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <button
                id="btn-otra-devolucion"
                onClick={registrarOtra}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Registrar otra devolución
              </button>
              <button
                id="btn-cerrar-resultado-devolucion"
                onClick={cerrar}
                className="flex-1 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* ── Turno ────────────────────────────────── */}
              <div className={`rounded-xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2 border ${
                turno ? 'bg-muted/30 border-border' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span id="devolucion-turno" className="flex items-center gap-2">
                  {cargandoTurno && <Loader2 size={14} className="animate-spin" />}
                  {cargandoTurno
                    ? 'Comprobando tu turno de caja…'
                    : turno
                      ? `Turno abierto: TURNO #${turno.idTurnoCaja} · ${turno.cajaNombre}`
                      : turnoError}
                </span>
                {!cargandoTurno && !turno && (
                  <button
                    id="btn-reintentar-turno-devolucion"
                    onClick={cargarTurno}
                    className="px-3 py-1.5 text-xs border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Reintentar
                  </button>
                )}
              </div>

              {/* ── 1. Venta ─────────────────────────────── */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  1 · Venta a devolver
                </p>

                {venta ? (
                  <div className="border border-border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-mono font-semibold">{venta.numeroControl}</p>
                      <p className="text-xs text-muted-foreground">
                        {venta.ncf || 'Sin NCF'} · {fmtFechaHora(venta.fechaVenta)} ·{' '}
                        {nombreCliente(venta.clienteNombre)} · {venta.almacenNombre || 'Sin almacén'}
                      </p>
                    </div>
                    <button
                      id="btn-cambiar-venta-devolucion"
                      onClick={volverABuscar}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} /> Elegir otra venta
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label htmlFor="input-buscar-venta-devolucion" className="sr-only">
                          Número de control o NCF de la venta
                        </label>
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            id="input-buscar-venta-devolucion"
                            type="text"
                            placeholder="N° de control o NCF…"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') buscarVentas(); }}
                            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        id="btn-buscar-venta-devolucion"
                        onClick={buscarVentas}
                        disabled={buscando || busqueda.trim().length === 0}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-40"
                      >
                        {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Buscar
                      </button>
                    </div>

                    {errorBusqueda && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                        <AlertTriangle size={15} /> {errorBusqueda}
                      </div>
                    )}

                    {resultados !== null && resultados.length === 0 && !buscando && !errorBusqueda && (
                      <p className="text-sm text-muted-foreground px-1">
                        Ninguna venta coincide con esa búsqueda.
                      </p>
                    )}

                    {resultados !== null && resultados.length > 0 && (
                      <div className="border border-border rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">N° Control</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">NCF</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Cliente</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {resultados.map(v => (
                              <tr key={v.idVenta} className="border-b border-border/50">
                                <td className="px-3 py-2 font-mono text-xs font-semibold">{v.numeroControl}</td>
                                <td className="px-3 py-2 font-mono text-xs">{v.ncf || 'Sin NCF'}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtFechaHora(v.fechaVenta)}</td>
                                <td className="px-3 py-2">{nombreCliente(v.clienteNombre)}</td>
                                <td className="px-3 py-2 text-right font-semibold">{fmtMoneda(v.total)}</td>
                                <td className="px-3 py-2 text-center text-xs">{v.estado}</td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    id={`btn-seleccionar-venta-${v.idVenta}`}
                                    onClick={() => seleccionarVenta(v.idVenta)}
                                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                                  >
                                    Seleccionar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {cargandoVenta && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 px-1">
                    <Loader2 size={14} className="animate-spin" /> Consultando lo devolvible…
                  </p>
                )}

                {errorVenta && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                    <AlertTriangle size={15} /> {errorVenta}
                  </div>
                )}
              </section>

              {/* ── 2. Líneas ────────────────────────────── */}
              {venta && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    2 · Unidades a devolver
                  </p>

                  {!venta.devolvible && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                      <AlertTriangle size={15} />
                      Esta venta ({venta.estado}) no admite devoluciones.
                    </div>
                  )}

                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Producto</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Precio</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Vendida</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Devuelta</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Disponible</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">A devolver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venta.lineas.map(linea => (
                          <tr id={`linea-devolucion-${linea.idDetalleVenta}`} key={linea.idDetalleVenta} className="border-b border-border/50">
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{linea.skuProducto}</td>
                            <td className="px-3 py-2">{linea.nombreProducto}</td>
                            <td className="px-3 py-2 text-right">{fmtMoneda(linea.precioUnitario)}</td>
                            <td className="px-3 py-2 text-center tabular-nums">{linea.cantidadVendida}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{linea.cantidadDevuelta}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold">
                              <span id={`disponible-linea-${linea.idDetalleVenta}`}>{linea.cantidadDisponible}</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                id={`input-cantidad-devolver-${linea.idDetalleVenta}`}
                                type="number"
                                min={0}
                                max={linea.cantidadDisponible}
                                step={1}
                                inputMode="numeric"
                                value={cantidades[linea.idDetalleVenta] ?? ''}
                                disabled={!venta.devolvible || linea.cantidadDisponible === 0 || enviando}
                                onChange={e => cambiarCantidad(linea.idDetalleVenta, linea.cantidadDisponible, e.target.value)}
                                className="w-20 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center tabular-nums focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-40"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-muted-foreground px-1">
                    El importe acreditado lo calcula el backend con los precios y el ITBIS que la venta
                    guardó: aquí solo se indican unidades.
                  </p>
                </section>
              )}

              {/* ── 3. Confirmación ──────────────────────── */}
              {venta && (
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    3 · Motivo y reembolso
                  </p>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label htmlFor="input-motivo-devolucion" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                        Motivo
                      </label>
                      <textarea
                        id="input-motivo-devolucion"
                        rows={2}
                        maxLength={300}
                        value={motivo}
                        disabled={enviando}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Por qué el cliente devuelve la mercancía…"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-foreground">
                        Emisión de Nota de Crédito
                      </label>
                      <div className="px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <span>🧾 Saldo Nota de Crédito B04</span>
                        </div>
                        <p>Esta devolución emitirá una Nota de Crédito por el valor acreditado para usar como saldo a favor en el POS.</p>
                      </div>
                    </div>
                  </div>

                  {errorEnvio && (
                    <div
                      id="error-devolucion"
                      className={`rounded-xl px-4 py-3 text-sm border flex flex-wrap items-center justify-between gap-2 ${
                        errorEnvio.yaRegistrada
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <AlertTriangle size={15} />
                        {errorEnvio.yaRegistrada
                          ? `Esta operación ya quedó registrada; búscala en el historial antes de repetirla. ${errorEnvio.mensaje}`
                          : errorEnvio.mensaje}
                      </span>
                      {errorEnvio.yaRegistrada ? (
                        <button
                          id="btn-ver-historial-devolucion"
                          onClick={cerrar}
                          className="px-3 py-1.5 text-xs border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          Ver el historial
                        </button>
                      ) : (
                        <button
                          id="btn-reintentar-devolucion"
                          onClick={confirmar}
                          disabled={enviando}
                          className="px-3 py-1.5 text-xs border border-red-300 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
                        >
                          Reintentar
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <span className="text-xs text-muted-foreground mr-auto">
                {unidades > 0
                  ? `${unidades} unidad${unidades !== 1 ? 'es' : ''} en ${detalles.length} línea${detalles.length !== 1 ? 's' : ''}`
                  : 'Indica al menos una unidad'}
              </span>
              <button
                id="btn-cerrar-devolucion"
                onClick={cerrar}
                disabled={enviando}
                className="px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-devolucion"
                onClick={confirmar}
                disabled={!puedeConfirmar}
                className="px-4 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
                {enviando ? 'Registrando…' : 'Confirmar devolución'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Historial de devoluciones
// ─────────────────────────────────────────────────────────

interface DevolucionesProps {
  userPermisos?: string[];
}

export default function Devoluciones({ userPermisos = [] }: DevolucionesProps) {
  // El backend es la autoridad: esto solo evita ofrecer un botón que acabaría
  // en 403.
  const puedeCrear = userPermisos.includes('DEVOLUCION_CREAR');

  const [devoluciones, setDevoluciones] = useState<DevolucionResumen[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idDetalle, setIdDetalle] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    devolucionesApi.listar(undefined, page, PAGE_SIZE)
      .then(pagina => {
        setDevoluciones(pagina.content);
        setTotalPages(pagina.totalPages);
        setTotalElements(pagina.totalElements);
      })
      .catch((e: any) => {
        setDevoluciones([]);
        setError(e.message || 'No se pudo cargar el historial de devoluciones.');
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { cargar(); }, [cargar]);

  // Una devolución nueva es siempre la más reciente: la primera página es la
  // que la contiene.
  const refrescarDesdeElPrincipio = () => {
    if (page === 0) cargar();
    else setPage(0);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Undo2 size={22} className="text-amber-600" />
            Devoluciones y Notas de Crédito
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Devoluciones confirmadas y el comprobante B04 que acredita cada una.
          </p>
        </div>
        {puedeCrear && (
          <button
            id="btn-nueva-devolucion"
            onClick={() => setCreando(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
          >
            <Plus size={15} /> Nueva devolución
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</span>
          <button
            id="btn-reintentar-devoluciones"
            onClick={cargar}
            className="px-3 py-1.5 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° Devolución</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Venta</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">B04</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">NCF afectado</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cajero</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reembolso</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-muted-foreground">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2" />
                    Cargando devoluciones…
                  </td>
                </tr>
              ) : error ? (
                // Una consulta que falló no dice nada sobre cuántas
                // devoluciones hay: anunciar aquí que no hay ninguna sería
                // confundir una avería con una base vacía.
                <tr>
                  <td colSpan={10} className="py-20 text-center text-muted-foreground">
                    <AlertTriangle size={36} className="mx-auto mb-2 opacity-30" />
                    <p>No se pudo consultar el historial.</p>
                    <p className="text-xs mt-1">Usa «Reintentar» para volver a pedirlo.</p>
                  </td>
                </tr>
              ) : devoluciones.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-muted-foreground">
                    <Undo2 size={36} className="mx-auto mb-2 opacity-30" />
                    <p>Todavía no hay devoluciones registradas.</p>
                  </td>
                </tr>
              ) : (
                devoluciones.map(d => (
                  <tr key={d.idDevolucion} className="border-b border-border/60 transition-colors hover:bg-muted/20">
                    <td className="px-3 py-3 font-mono text-xs font-semibold">{d.numeroControl}</td>
                    <td className="px-3 py-3 font-mono text-xs">{d.numeroControlVenta}</td>
                    <td className="px-3 py-3 font-mono text-xs">{d.ncf}</td>
                    <td className="px-3 py-3 font-mono text-xs">{d.ncfAfectado || 'Sin NCF'}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{fmtFechaHora(d.fechaDevolucion)}</td>
                    <td className="px-3 py-3 text-sm">{d.cajeroNombre}</td>
                    <td className="px-3 py-3 text-xs">{etiquetaReembolso(d.metodoReembolso)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmtMoneda(d.total)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-amber-100 text-amber-700 border-amber-200">
                        {d.estado}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        id={`btn-detalle-devolucion-${d.idDevolucion}`}
                        onClick={() => setIdDetalle(d.idDevolucion)}
                        title="Ver detalle"
                        className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors text-muted-foreground"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <span>
              {totalElements} devoluci{totalElements !== 1 ? 'ones' : 'ón'}
              {totalPages > 0 ? ` · Página ${page + 1} de ${totalPages}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                id="btn-devoluciones-pagina-anterior"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                id="btn-devoluciones-pagina-siguiente"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {idDetalle !== null && (
        <DetalleDevolucionModal idDevolucion={idDetalle} onClose={() => setIdDetalle(null)} />
      )}

      {creando && (
        <NuevaDevolucionModal
          onCerrar={(refrescarHistorial) => {
            setCreando(false);
            if (refrescarHistorial) refrescarDesdeElPrincipio();
          }}
          onRefrescar={refrescarDesdeElPrincipio}
        />
      )}
    </div>
  );
}
