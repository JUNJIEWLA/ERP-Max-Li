import { Percent } from 'lucide-react';

interface DiscountPanelProps {
  descuentoGlobal: number;
  onDescuentoGlobalChange: (value: number) => void;
  descuentoAutomatico: number;
  descuentoLinea: number;
  totalAhorrado: number;
}

export default function DiscountPanel({
  descuentoGlobal,
  onDescuentoGlobalChange,
  descuentoAutomatico,
  descuentoLinea,
  totalAhorrado
}: DiscountPanelProps) {
  return (
    <div className="border-r border-border bg-muted/30 p-4 w-64">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm mb-3 flex items-center gap-2">
            <Percent size={16} />
            DESCUENTO GLOBAL
          </h4>
          <div className="flex items-center gap-2">
            <select className="flex-1 px-3 py-2 border border-border rounded-lg bg-background">
              <option>Tipo</option>
              <option>%</option>
              <option>RD$</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={descuentoGlobal}
              onChange={(e) => onDescuentoGlobalChange(parseFloat(e.target.value) || 0)}
              className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-right"
              placeholder="0"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Se aplicará al subtotal de toda la venta
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <h4 className="text-sm mb-3">RESUMEN DE DESCUENTOS</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ofertas automáticas</span>
              <span className="text-green-600">RD${descuentoAutomatico.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desc. por línea</span>
              <span className="text-green-600">RD${descuentoLinea.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desc. global</span>
              <span className="text-green-600">RD${descuentoGlobal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span>Total ahorrado</span>
              <span className="text-green-600">RD${totalAhorrado.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
