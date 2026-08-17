import { useCallback, useEffect, useState } from 'react';
import {
  Receipt, Search, Eye, Loader2, AlertTriangle, X, Printer, RotateCcw,
  FileText, Ticket as TicketIcon, CheckCircle2
} from 'lucide-react';
import {
  ventasApi, empresaApi, type DetalleVentaResponse, type VentaFiltros, type VentaResumen, type VentaResponse, type ConfiguracionEmpresa,
} from '../../imports/api';
import TicketImpresion from './pos/TicketImpresion';
import FacturaImpresionA4 from './pos/FacturaImpresionA4';

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

/** Convierte el porcentaje de línea y los demás descuentos a un monto real. */
const descuentoMonetario = (detalle: DetalleVentaResponse) =>
  Math.max(0, detalle.precioUnitario * detalle.cantidad - detalle.importe)
    + detalle.descuentoProrrateado;

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'CUPON', 'MIXTO'];

const FILTROS_VACIOS: VentaFiltros = {
  q: '', fechaDesde: '', fechaHasta: '', cajero: '', metodoPago: '',
};

const PAGE_SIZE = 15;

// ── Modal de detalle ─────────────────────────────────────

function DetalleVentaModal({ idVenta, onClose }: { idVenta: number; onClose: () => void }) {
  const [venta, setVenta] = useState<VentaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Impresión y selección de formato
  const [empresa, setEmpresa] = useState<ConfiguracionEmpresa | null>(null);
  const [showSelectorFormato, setShowSelectorFormato] = useState(false);
  const [formatoImpresion, setFormatoImpresion] = useState<'80MM' | 'A4' | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    ventasApi.buscarPorId(idVenta)
      .then(setVenta)
      .catch((e: any) => setError(e.message || 'No se pudo cargar el detalle de la venta.'))
      .finally(() => setLoading(false));
  }, [idVenta]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cargar datos de la empresa para la factura
  useEffect(() => {
    empresaApi.obtener()
      .then(setEmpresa)
      .catch(() => {});
  }, []);

  const handleSeleccionarFormato = (formato: '80MM' | 'A4') => {
    setFormatoImpresion(formato);
    setShowSelectorFormato(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Templates de impresión ocultos en pantalla pero activos para @media print */}
      {venta && formatoImpresion === '80MM' && (
        <TicketImpresion venta={venta} empresa={empresa} esCopia />
      )}
      {venta && formatoImpresion === 'A4' && (
        <FacturaImpresionA4 venta={venta} empresa={empresa} esCopia />
      )}

      {/* Modal de Selección de Formato */}
      {showSelectorFormato && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowSelectorFormato(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Printer size={20} className="text-primary" />
                <h3 className="font-bold text-lg text-foreground">Formato de Reimpresión</h3>
              </div>
              <button
                onClick={() => setShowSelectorFormato(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Selecciona el formato de salida para reimprimir el comprobante de la venta{' '}
              <strong className="text-foreground">{venta?.numeroControl}</strong>:
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                id="btn-formato-80mm"
                onClick={() => handleSeleccionarFormato('80MM')}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
              >
                <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <TicketIcon size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Ticket Térmico (80mm)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Formato de rollo para impresoras térmicas POS. Compacto e ideal para caja.
                  </p>
                </div>
              </button>

              <button
                id="btn-formato-a4"
                onClick={() => handleSeleccionarFormato('A4')}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:border-violet-500 hover:bg-violet-500/5 transition-all text-left group"
              >
                <div className="p-3 bg-violet-500/10 text-violet-600 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Factura Tamaño Carta / A4</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hoja completa formal con membrete corporativo, desglose detallado e-NCF y cliente.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSelectorFormato(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Principal de Detalle */}
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="no-imprimir flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Detalle de Venta</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
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
              onClick={cargar}
              className="w-full py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && venta && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Cabecera de la venta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">N° Control</p>
                  <p className="font-bold mt-0.5 font-mono">{venta.numeroControl}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">NCF</p>
                  <p className="font-bold mt-0.5 font-mono">{venta.ncf || 'Sin NCF'}</p>
                  <p className="text-xs text-muted-foreground">{venta.tipoNcf || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-semibold mt-0.5 text-xs">{fmtFechaHora(venta.fechaVenta)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="font-bold mt-0.5">{venta.estado}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Cajero</p>
                  <p className="font-semibold mt-0.5">{venta.cajeroNombre}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Turno</p>
                  <p className="font-semibold mt-0.5">TURNO #{venta.idTurnoCaja}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Almacén</p>
                  <p className="font-semibold mt-0.5">{venta.almacenNombre || 'No registrado'}</p>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-semibold mt-0.5">
                    {nombreCliente(venta.clienteNombre || venta.nombreClienteTemporal)}
                  </p>
                  {(venta.clienteRncCedula || venta.rncTemporal) && (
                    <p className="text-xs text-muted-foreground">
                      RNC/Cédula: {venta.clienteRncCedula || venta.rncTemporal}
                    </p>
                  )}
                </div>
              </div>

              {/* Líneas */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Productos ({venta.detalles.length})
                </p>
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Cant.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Precio</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Descuentos</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Base imp.</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">ITBIS</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venta.detalles.map(d => (
                        <tr key={d.idDetalleVenta} className="border-b border-border/50">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.skuProducto}</td>
                          <td className="px-3 py-2">
                            {d.nombreProducto}
                            {d.ofertaAplicada && (
                              <span className="block text-xs text-emerald-700">Oferta: {d.ofertaAplicada}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{d.cantidad}</td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.precioUnitario)}</td>
                          <td className="px-3 py-2 text-right">
                            {fmtMoneda(descuentoMonetario(d))}
                          </td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.baseImponible)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoneda(d.itbisLinea)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmtMoneda(d.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales y pagos */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-border rounded-xl p-4 text-sm space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Totales</p>
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoneda(venta.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Descuento total</span><span>{fmtMoneda(venta.descuentoTotal)}</span></div>
                  <div className="flex justify-between">
                    <span>Cupón {venta.codigoCupon ? `(${venta.codigoCupon})` : ''}</span>
                    <span>{venta.codigoCupon ? fmtMoneda(venta.descuentoCupon) : 'No aplica'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ITBIS</span><span id="detalle-itbis">{fmtMoneda(venta.itbis)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-border pt-1 mt-1">
                    <span>Total</span><span id="detalle-total">{fmtMoneda(venta.total)}</span>
                  </div>
                </div>

                <div id="detalle-pagos" className="border border-border rounded-xl p-4 text-sm space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pagos</p>
                  {venta.ingresos.map(i => (
                    <div key={i.idIngresoVenta} className="flex justify-between">
                      <span>{i.metodoPago}{i.referencia ? ` · ${i.referencia}` : ''}</span>
                      <span>{fmtMoneda(i.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span>Monto recibido</span><span id="detalle-recibido">{fmtMoneda(venta.montoRecibido)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Cambio</span><span id="detalle-cambio">{fmtMoneda(venta.cambio)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Cerrar
              </button>
              <button
                id="btn-reimprimir-venta"
                onClick={() => setShowSelectorFormato(true)}
                className="flex-1 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20"
              >
                <Printer size={16} /> Reimprimir comprobante
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Historial de Ventas ──────────────────────────────────

export default function Ventas() {
  // Lo que el usuario está escribiendo, separado de lo que ya se consultó: la
  // tabla solo cambia al pulsar Buscar, nunca a cada tecla.
  const [form, setForm] = useState<VentaFiltros>(FILTROS_VACIOS);
  const [filtros, setFiltros] = useState<VentaFiltros>(FILTROS_VACIOS);

  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idDetalle, setIdDetalle] = useState<number | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    ventasApi.listar(filtros, page, PAGE_SIZE)
      .then(pagina => {
        setVentas(pagina.content);
        setTotalPages(pagina.totalPages);
        setTotalElements(pagina.totalElements);
      })
      .catch((e: any) => {
        setVentas([]);
        setError(e.message || 'No se pudo cargar el historial de ventas.');
      })
      .finally(() => setLoading(false));
  }, [filtros, page]);

  useEffect(() => { cargar(); }, [cargar]);

  // Buscar y limpiar siempre vuelven a la primera página: la página 3 de los
  // filtros anteriores no significa nada con los nuevos.
  const buscar = () => { setPage(0); setFiltros(form); };
  const limpiar = () => { setPage(0); setForm(FILTROS_VACIOS); setFiltros(FILTROS_VACIOS); };

  const campo = (clave: keyof VentaFiltros) => ({
    value: form[clave] ?? '',
    onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [clave]: e.target.value })),
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Receipt size={22} className="text-blue-500" />
          Historial de Ventas
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Consulta de ventas registradas. Solo lectura.
        </p>
      </div>

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <label htmlFor="filtro-ventas-q" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
            Buscar
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="filtro-ventas-q"
              type="text"
              placeholder="N° control, NCF o cliente…"
              {...campo('q')}
              onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="filtro-ventas-desde" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
            Desde
          </label>
          <input
            id="filtro-ventas-desde"
            type="date"
            {...campo('fechaDesde')}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="filtro-ventas-hasta" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
            Hasta
          </label>
          <input
            id="filtro-ventas-hasta"
            type="date"
            {...campo('fechaHasta')}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="filtro-ventas-cajero" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
            Cajero
          </label>
          <input
            id="filtro-ventas-cajero"
            type="text"
            placeholder="Usuario"
            {...campo('cajero')}
            onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
            className="w-36 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="filtro-ventas-metodo" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
            Método de pago
          </label>
          <select
            id="filtro-ventas-metodo"
            {...campo('metodoPago')}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">Todos</option>
            {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <button
          id="btn-buscar-ventas"
          onClick={buscar}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
        >
          <Search size={15} /> Buscar
        </button>
        <button
          id="btn-limpiar-filtros-ventas"
          onClick={limpiar}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
        >
          <RotateCcw size={15} /> Limpiar
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</span>
          <button
            id="btn-reintentar-ventas"
            onClick={cargar}
            className="px-3 py-1.5 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° Control</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">NCF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cajero</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2" />
                    Cargando ventas…
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground">
                    <Receipt size={36} className="mx-auto mb-2 opacity-30" />
                    <p>No hay ventas que coincidan con los filtros.</p>
                  </td>
                </tr>
              ) : (
                ventas.map(v => (
                  <tr key={v.idVenta} className="border-b border-border/60 transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{v.numeroControl}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtFechaHora(v.fechaVenta)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{v.ncf || 'Sin NCF'}</td>
                    <td className="px-4 py-3">{nombreCliente(v.clienteNombre)}</td>
                    <td className="px-4 py-3 text-sm">{v.cajeroNombre}</td>
                    <td className="px-4 py-3 text-xs">{v.metodoPagoPrincipal}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtMoneda(v.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
                        {v.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        id={`btn-detalle-venta-${v.idVenta}`}
                        onClick={() => setIdDetalle(v.idVenta)}
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
              {totalElements} venta{totalElements !== 1 ? 's' : ''}
              {totalPages > 0 ? ` · Página ${page + 1} de ${totalPages}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                id="btn-ventas-pagina-anterior"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                id="btn-ventas-pagina-siguiente"
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
        <DetalleVentaModal idVenta={idDetalle} onClose={() => setIdDetalle(null)} />
      )}
    </div>
  );
}
