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
      <div className="px-4 py-2 border-b border-border">
        <div className="flex gap-6">
          {/* Panel de Descuentos - Izquierda */}
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="text-xs mb-1.5 font-medium">DESCUENTO GLOBAL</h4>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select className="px-2 py-1 border border-border rounded bg-background text-xs">
                  <option>%</option>
                  <option>RD$</option>
                </select>
                <label className="text-xs text-muted-foreground ml-1">Valor</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuentoGlobal}
                  onChange={(e) => onDescuentoGlobalChange(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border border-border rounded bg-background text-xs text-right"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Aplica sobre el subtotal de toda la venta
              </p>
            </div>

            <div>
              <h4 className="text-xs mb-1.5 font-medium">RESUMEN DE DESCUENTOS</h4>
              <div className="space-y-0.5 text-xs">
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
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="font-medium">Total ahorrado</span>
                  <span className="text-green-600 font-medium">RD${totalAhorrado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Totales - Derecha */}
          <div className="w-72 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal sin ITBIS</span>
              <span>RD${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ITBIS</span>
              <span>RD${itbis.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyan-500">Desc. por línea</span>
              <span className="text-cyan-500">-RD${descuentoLinea.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyan-500">Ofertas aplicadas</span>
              <span className="text-cyan-500">-RD${descuentoAutomatico.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyan-500">Desc. global</span>
              <span className="text-cyan-500">-RD${descuentoGlobal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t-2 border-border items-baseline">
              <span className="text-base">Total</span>
              <span className="text-2xl text-red-600 font-medium">RD${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-6 text-xs">
        <span>Cliente (F3): <strong>{clienteNombre}</strong></span>
        <span>Artículos: <strong>{totalItems}</strong></span>
        <span>NCF: <strong>{ncfTipo}</strong> • {tipoNCF}</span>
      </div>
    </div>
  );
}
