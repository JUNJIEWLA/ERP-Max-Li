import { Percent, Tag, UserCircle, CheckCircle2 } from 'lucide-react';

interface SaleSummaryPanelProps {
  totalItems: number;
  clienteNombre: string;
  tieneClienteSeleccionado: boolean;
  descuentoClientePredeterminado: number;
  onAbrirSelectorCliente: () => void;
  ncfTipo: string;
  tipoNCF: string;
  descuentoGlobal: number;
  tipoDescuentoGlobal: '%' | 'RD$';
  onDescuentoGlobalChange: (value: number) => void;
  onTipoDescuentoGlobalChange: (tipo: '%' | 'RD$') => void;
  descuentoGlobalMonto: number;
  descuentoAutomatico: number;
  descuentoLinea: number;
  totalAhorrado: number;
  /**
   * Desglose fiscal real (base imponible / ITBIS por línea), calculado por
   * el backend. `null` mientras no haya un preview real disponible — nunca
   * se aproxima con una tasa fija en el cliente (ISSUE-008).
   */
  subtotal: number | null;
  itbis: number | null;
  total: number;
}

export default function SaleSummaryPanel({
  totalItems,
  clienteNombre,
  tieneClienteSeleccionado,
  descuentoClientePredeterminado,
  onAbrirSelectorCliente,
  ncfTipo,
  tipoNCF,
  descuentoGlobal,
  tipoDescuentoGlobal,
  onDescuentoGlobalChange,
  onTipoDescuentoGlobalChange,
  descuentoGlobalMonto,
  descuentoAutomatico,
  descuentoLinea,
  totalAhorrado,
  subtotal,
  itbis,
  total,
}: SaleSummaryPanelProps) {
  return (
    <div className="flex flex-col border-l border-border bg-background" style={{ width: '268px', minWidth: '268px' }}>
      {/* Cliente / NCF */}
      <button
        id="pos-btn-cliente"
        onClick={onAbrirSelectorCliente}
        title="F3 — Seleccionar cliente"
        className={`w-full px-3 py-2 border-b border-border text-left transition-colors ${
          tieneClienteSeleccionado
            ? 'bg-emerald-50/60 hover:bg-emerald-100/60'
            : 'bg-muted/30 hover:bg-muted/50'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          {tieneClienteSeleccionado
            ? <CheckCircle2 size={12} className="text-emerald-500" />
            : <UserCircle size={12} />}
          <span>Cliente (F3)</span>
          {tieneClienteSeleccionado && descuentoClientePredeterminado > 0 && (
            <span className="ml-auto text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              <Percent size={10} />{descuentoClientePredeterminado}%
            </span>
          )}
        </div>
        <p className={`text-sm font-medium truncate ${
          tieneClienteSeleccionado ? 'text-emerald-700' : ''
        }`}>{clienteNombre}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          NCF: <strong className="text-foreground">{ncfTipo}</strong> &bull; {tipoNCF}
        </p>
      </button>

      {/* Descuento global */}
      <div className="px-3 py-3 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Percent size={12} />
          Descuento global
        </h4>
        <div className="flex items-center gap-1.5">
          <select
            value={tipoDescuentoGlobal}
            onChange={(e) => onTipoDescuentoGlobalChange(e.target.value as '%' | 'RD$')}
            className="flex-1 px-2 py-1.5 border border-border rounded bg-background text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="%">%</option>
            <option value="RD$">RD$</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={descuentoGlobal || ''}
            onChange={(e) => onDescuentoGlobalChange(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 border border-border rounded bg-background text-xs text-right font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="0"
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1.5 flex justify-between items-center">
          <span>Aplica sobre subtotal</span>
          {tipoDescuentoGlobal === '%' && descuentoGlobal > 0 && (
            <span className="font-semibold text-emerald-600 font-mono">
              = -RD${descuentoGlobalMonto.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Resumen de descuentos */}
      <div className="px-3 py-3 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Tag size={12} />
          Resumen de descuentos
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ofertas automáticas</span>
            <span className="text-green-600 font-mono">-RD${descuentoAutomatico.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Desc. por línea</span>
            <span className="text-green-600 font-mono">-RD${descuentoLinea.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Desc. global {tipoDescuentoGlobal === '%' ? `(${descuentoGlobal}%)` : '(fijo)'}
            </span>
            <span className="text-green-600 font-mono">-RD${descuentoGlobalMonto.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-border font-medium">
            <span>Total ahorrado</span>
            <span className="text-green-600 font-mono">RD${totalAhorrado.toFixed(2)}</span>
          </div>
        </div>
      </div>


      {/* Totales — ocupa el espacio restante y pega los valores al fondo */}
      <div className="flex-1 flex flex-col justify-end px-3 py-3">
        <div className="space-y-1.5 text-xs">
          {subtotal !== null && itbis !== null ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal sin ITBIS</span>
                <span className="font-mono text-foreground font-medium">RD${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ITBIS</span>
                <span className="font-mono text-foreground font-medium">RD${itbis.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground italic">
              El desglose de ITBIS se calcula al cobrar (tasa por producto)
            </p>
          )}
        </div>

        {/* Total grande */}
        <div className="flex justify-between items-baseline pt-3 mt-2 border-t-2 border-border">
          <span className="text-base font-semibold">Total a Pagar</span>
          <span className="text-2xl text-red-600 font-bold font-mono">RD${total.toFixed(2)}</span>
        </div>

        {/* Artículos */}
        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground font-medium">Artículos facturados:</span>
          <span className="text-base font-bold text-blue-600 bg-blue-50/70 border border-blue-200/50 px-2.5 py-0.5 rounded-md">
            {totalItems}
          </span>
        </div>
      </div>

    </div>
  );
}
