import { useState, useEffect, useCallback, useRef } from 'react';

import {
  X, CreditCard, Banknote, Building2, FileText, ArrowUpDown,
  AlertTriangle, CheckCircle2, Ticket, Loader2
} from 'lucide-react';
import {
  ventasApi,
  type RecalcularFacturaRequest,
  type RecalcularFacturaResponse,
  type DetalleRecalculado,
  type CrearVentaRequest,
  type VentaResponse,
} from '../../../imports/api';
import { CartItem } from './CartRow';

interface CheckoutModalProps {
  cart: CartItem[];
  idTurnoCaja: number;
  idCliente: number | null;
  nombreClienteTemporal: string;
  rncTemporal: string;
  tipoNcf: string;
  descuentoGlobal: number;
  onClose: () => void;
  onVentaCompletada: (venta: VentaResponse) => void;
}

const METODOS_PAGO = [
  { id: 'EFECTIVO',      label: 'Efectivo',      icon: Banknote,   color: 'emerald' },
  { id: 'TARJETA',       label: 'Tarjeta',       icon: CreditCard, color: 'blue' },
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: ArrowUpDown, color: 'violet' },
  { id: 'CHEQUE',        label: 'Cheque',        icon: FileText,   color: 'amber' },
] as const;

const TIPOS_NCF = [
  { codigo: 'B02', nombre: 'Consumidor Final' },
  { codigo: 'B01', nombre: 'Crédito Fiscal' },
  { codigo: 'B14', nombre: 'Régimen Especial' },
  { codigo: 'B15', nombre: 'Gubernamental' },
];

export default function CheckoutModal({
  cart,
  idTurnoCaja,
  idCliente,
  nombreClienteTemporal: initialNombre,
  rncTemporal: initialRnc,
  tipoNcf: initialTipoNcf,
  descuentoGlobal,
  onClose,
  onVentaCompletada,
}: CheckoutModalProps) {
  // ── State ──────────────────────────────────────────────────────────
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [tipoNcf, setTipoNcf] = useState(initialTipoNcf || 'B02');
  const [usaPrecioMayor, setUsaPrecioMayor] = useState(false);
  const [nombreCliente, setNombreCliente] = useState(initialNombre || '');
  const [rnc, setRnc] = useState(initialRnc || '');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [codigoCupon, setCodigoCupon] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');

  // Recálculo
  const [recalculo, setRecalculo] = useState<RecalcularFacturaResponse | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  // Procesamiento
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [ventaProcesada, setVentaProcesada] = useState<VentaResponse | null>(null);

  // ── Totales calculados ──────────────────────────────────────────────
  const subtotalCarrito = cart.reduce((sum, item) => sum + item.importe, 0);
  const total = recalculo ? recalculo.total : Math.max(0, subtotalCarrito - descuentoGlobal);
  // El desglose de ITBIS solo viene del backend (tasa por línea, ISSUE-008):
  // nunca se aproxima con /1.18 en el cliente. Antes de la primera respuesta
  // del preview, se muestra como pendiente en vez de un valor inventado.
  const subtotalSinItbis = recalculo ? recalculo.subtotal : null;
  const itbis = recalculo ? recalculo.itbis : null;
  const cambio = parseFloat(montoRecibido || '0') - total;


  const montoInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus montoRecibido al abrir el modal
  useEffect(() => {
    setTimeout(() => {
      montoInputRef.current?.focus();
      montoInputRef.current?.select();
    }, 100);
  }, []);

  const cycleMetodoPago = useCallback((direction: 'next' | 'prev') => {
    const currentIdx = METODOS_PAGO.findIndex(m => m.id === metodoPago);
    if (direction === 'next') {
      const nextIdx = (currentIdx + 1) % METODOS_PAGO.length;
      setMetodoPago(METODOS_PAGO[nextIdx].id);
    } else {
      const prevIdx = (currentIdx - 1 + METODOS_PAGO.length) % METODOS_PAGO.length;
      setMetodoPago(METODOS_PAGO[prevIdx].id);
    }
  }, [metodoPago]);

  const cycleTipoNcf = useCallback((direction: 'next' | 'prev') => {
    const currentIdx = TIPOS_NCF.findIndex(n => n.codigo === tipoNcf);
    if (direction === 'next') {
      const nextIdx = (currentIdx + 1) % TIPOS_NCF.length;
      setTipoNcf(TIPOS_NCF[nextIdx].codigo);
    } else {
      const prevIdx = (currentIdx - 1 + TIPOS_NCF.length) % TIPOS_NCF.length;
      setTipoNcf(TIPOS_NCF[prevIdx].codigo);
    }
  }, [tipoNcf]);

  // ── Recalcular al cambiar método/NCF/mayor ─────────────────────────
  const ejecutarRecalculo = useCallback(async () => {
    if (cart.length === 0) return;
    setRecalculando(true);
    setError('');
    try {
      const request: RecalcularFacturaRequest = {
        metodoPago,
        tipoNcf,
        usaPrecioMayor,
        descuentoGlobal,
        codigoCupon: codigoCupon || undefined,
        detalles: cart.map((item) => ({
          idProducto: item.id,
          cantidad: item.cantidad,
          descuentoLinea: item.descuentoLinea,
        })),
      };
      const response = await ventasApi.recalcular(request);
      setRecalculo(response);
    } catch (err: any) {
      setError(err.message || 'Error al recalcular');
    } finally {
      setRecalculando(false);
    }
  }, [cart, metodoPago, tipoNcf, usaPrecioMayor, descuentoGlobal, codigoCupon]);


  useEffect(() => {
    ejecutarRecalculo();
  }, [ejecutarRecalculo]);

  // ── Global Keydown handler ─────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'F1') { e.preventDefault(); setMetodoPago('EFECTIVO'); return; }
      if (e.key === 'F2') { e.preventDefault(); setMetodoPago('TARJETA'); return; }
      if (e.key === 'F3') { e.preventDefault(); setMetodoPago('TRANSFERENCIA'); return; }
      if (e.key === 'F4') { e.preventDefault(); setMetodoPago('CHEQUE'); return; }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);


  // ── Procesar la venta ──────────────────────────────────────────────
  const handleProcesar = async () => {
    const montoNum = parseFloat(montoRecibido || '0');
    if (montoNum < total) {
      setError(`El monto recibido (RD$ ${montoNum.toFixed(2)}) es menor al total (RD$ ${total.toFixed(2)})`);
      return;
    }

    setProcesando(true);
    setError('');

    try {
      const request: CrearVentaRequest = {
        idTurnoCaja,
        idCliente: idCliente || undefined,
        nombreClienteTemporal: nombreCliente || undefined,
        rncTemporal: rnc || undefined,
        tipoNcf,
        metodoPago,
        usaPrecioMayor,
        descuentoGlobal,
        codigoCupon: codigoCupon || undefined,
        detalles: cart.map((item) => ({
          idProducto: item.id,
          cantidad: item.cantidad,
          descuentoLinea: item.descuentoLinea,
        })),
        ingresos: [{
          metodoPago,
          monto: montoNum,
          referencia: undefined,
        }],

      };

      const venta = await ventasApi.procesar(request);
      setVentaProcesada(venta);
      setExito(true);

      // Auto-cerrar después de 2s
      setTimeout(() => {
        onVentaCompletada(venta);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la venta');
    } finally {
      setProcesando(false);
    }
  };

  // ── Pantalla de éxito ──────────────────────────────────────────────
  if (exito && ventaProcesada) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-background rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">¡Venta Procesada!</h2>
          <p className="text-muted-foreground mb-4">
            N° Control: <strong>{ventaProcesada.numeroControl}</strong>
          </p>
          {ventaProcesada.ncf && (
            <p className="text-sm text-muted-foreground mb-2">
              NCF: <strong>{ventaProcesada.ncf}</strong>
            </p>
          )}
          <div className="bg-emerald-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-emerald-700">Total cobrado</p>
            <p className="text-3xl font-bold text-emerald-600">RD${ventaProcesada.total.toFixed(2)}</p>
            {ventaProcesada.cambio > 0 && (
              <p className="text-sm text-emerald-600 mt-1">
                Cambio: <strong>RD${ventaProcesada.cambio.toFixed(2)}</strong>
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Cerrando automáticamente...</p>
        </div>
      </div>
    );
  }

  // ── Modal principal ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-lg font-bold">Cobro de Venta</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Cliente / RNC ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Datos del cliente (facturación)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nombre del cliente</label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={e => setNombreCliente(e.target.value)}
                  placeholder="Consumidor Final"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">RNC / Cédula</label>
                <input
                  type="text"
                  value={rnc}
                  onChange={e => setRnc(e.target.value)}
                  placeholder="000-00000-0"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              Estos datos se imprimirán en la factura sin crear un registro permanente de cliente.
            </p>
          </section>

          {/* ── Tipo NCF ──────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Tipo de comprobante fiscal (NCF)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_NCF.map(ncf => (
                <button
                  key={ncf.codigo}
                  onClick={() => setTipoNcf(ncf.codigo)}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all ${
                    tipoNcf === ncf.codigo
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border hover:bg-accent text-foreground'
                  }`}
                >
                  <span className="font-mono text-xs block mb-0.5">{ncf.codigo}</span>
                  {ncf.nombre}
                </button>
              ))}
            </div>
          </section>

          {/* ── Método de Pago ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Método de pago
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {METODOS_PAGO.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setMetodoPago(id)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                    metodoPago === id
                      ? `border-${color}-500 bg-${color}-50 text-${color}-700 ring-2 ring-${color}-200`
                      : 'border-border hover:bg-accent text-foreground'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </section>


          {/* ── Precio Mayorista Toggle ────────────────────────── */}
          <section>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usaPrecioMayor}
                onChange={e => setUsaPrecioMayor(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Aplicar precios al por mayor</span>
            </label>
          </section>

          {/* ── Alertas de recálculo ──────────────────────────── */}
          {recalculo?.huboRecalculo && (
            <section className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <AlertTriangle size={16} />
                Precios recalculados
              </div>
              {recalculo.detalles
                .filter((d: DetalleRecalculado) => d.recalculado)
                .map((d: DetalleRecalculado) => (
                  <div key={d.idProducto} className="text-xs text-amber-700 pl-6">
                    <strong>{d.nombreProducto}:</strong> {d.mensajeRecalculo}
                  </div>
                ))}
            </section>
          )}

          {/* ── Cupón ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              <Ticket size={12} className="inline mr-1" /> Cupón de descuento
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoCupon}
                onChange={e => setCodigoCupon(e.target.value.toUpperCase())}
                placeholder="Código del cupón"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <button
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
                disabled={!codigoCupon}
              >
                Validar
              </button>
            </div>
          </section>

          {/* ── Monto a recibir + cambio ──────────────────────── */}
          <section className="bg-muted/30 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-monto-recibido" className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Monto recibido
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">RD$</span>
                  <input
                    id="input-monto-recibido"
                    ref={montoInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoRecibido}
                    onChange={e => setMontoRecibido(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcesar();
                      }
                    }}
                    placeholder="0.00"
                    readOnly={metodoPago === 'TARJETA'}
                    className={`w-full pl-10 pr-3 py-3 border rounded-lg text-xl font-bold text-right bg-background focus:ring-2 focus:ring-primary focus:outline-none ${
                      metodoPago === 'TARJETA' ? 'bg-muted/50 text-muted-foreground border-border' : 'border-border'
                    }`}
                  />

                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Cambio / Vuelto
                </label>
                <div id="checkout-cambio" className={`w-full px-3 py-3 rounded-lg text-xl font-bold text-right ${
                  cambio >= 0
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  RD${Math.max(0, cambio).toFixed(2)}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30">
          {/* Error */}
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Totales */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm space-y-0.5">
              <div className="text-muted-foreground">
                Subtotal sin ITBIS: <span className="text-foreground font-medium font-mono">
                  {subtotalSinItbis !== null ? `RD$${subtotalSinItbis.toFixed(2)}` : 'Calculando…'}
                </span>
              </div>
              <div className="text-muted-foreground">
                ITBIS: <span className="text-foreground font-medium font-mono">
                  {itbis !== null ? `RD$${itbis.toFixed(2)}` : 'Calculando…'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground block">Total a cobrar</span>
              <span className="text-3xl font-bold text-red-600 font-mono">RD${total.toFixed(2)}</span>
            </div>
          </div>


          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcesar}
              disabled={procesando || recalculando || parseFloat(montoRecibido || '0') < total || cart.length === 0}
              className="flex-[2] px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {procesando ? (
                <><Loader2 size={18} className="animate-spin" /> Procesando...</>
              ) : recalculando ? (
                <><Loader2 size={18} className="animate-spin" /> Recalculando...</>
              ) : (
                `Cobrar RD$${total.toFixed(2)}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
