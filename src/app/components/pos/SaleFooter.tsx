interface SaleFooterProps {
  totalItems: number;
  clienteNombre: string;
  ncfTipo: string;
  tipoNCF: string;
  descuentoGlobal: number;
  onDescuentoGlobalChange: (value: number) => void;
  descuentoAutomatico: number;
  descuentoLinea: number;
  totalAhorrado: number;
  subtotal: number;
  itbis: number;
  total: number;
}

export default function SaleFooter({
  totalItems,
  clienteNombre,
  ncfTipo,
  tipoNCF,
  descuentoGlobal,
  onDescuentoGlobalChange,
  descuentoAutomatico,
  descuentoLinea,
  totalAhorrado,
  subtotal,
  itbis,
  total
}: SaleFooterProps) {
  return (
    <div className="border-t border-border bg-background">
      <div className="p-4 border-b border-border">
        <div className="flex gap-8">
          {/* Panel de Descuentos - Izquierda */}
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-sm mb-3">DESCUENTO GLOBAL</h4>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Tipo</label>
                <select className="px-3 py-1.5 border border-border rounded bg-background text-sm">
                  <option>%</option>
                  <option>RD$</option>
                </select>
                <label className="text-sm text-muted-foreground ml-2">Valor</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuentoGlobal}
                  onChange={(e) => onDescuentoGlobalChange(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-1.5 border border-border rounded bg-background text-sm text-right"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Aplica sobre el subtotal de toda la venta
              </p>
            </div>

            <div>
              <h4 className="text-sm mb-3">RESUMEN DE DESCUENTOS</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ofertas automáticas</span>
                  <span className="text-green-600">-RD${descuentoAutomatico.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desc. por línea</span>
                  <span className="text-green-600">-RD${descuentoLinea.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desc. global</span>
                  <span className="text-green-600">-RD${descuentoGlobal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span>Total ahorrado</span>
                  <span className="text-green-600 font-medium">RD${totalAhorrado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Totales - Derecha */}
          <div className="w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal sin ITBIS</span>
              <span>RD${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ITBIS (18%)</span>
              <span>RD${itbis.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cyan-500">Desc. por línea</span>
              <span className="text-cyan-500">-RD${descuentoLinea.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cyan-500">Ofertas aplicadas</span>
              <span className="text-cyan-500">-RD${descuentoAutomatico.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cyan-500">Desc. global</span>
              <span className="text-cyan-500">-RD${descuentoGlobal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-border">
              <span className="text-lg">Total</span>
              <span className="text-3xl text-red-600 font-medium">RD${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 flex items-center gap-6 text-sm">
        <span>Cliente (F3): <strong>{clienteNombre}</strong></span>
        <span>Artículos: <strong>{totalItems}</strong></span>
        <span>NCF: <strong>{ncfTipo}</strong> • {tipoNCF}</span>
      </div>
    </div>
  );
}
