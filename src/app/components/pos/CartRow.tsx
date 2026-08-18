import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';

export interface CartItem {
  id: number;
  codigo: string;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  descuentoLinea: number;
  unidad: string;
  importe: number;
  tasaItbis?: number;
  itbisLinea?: number;
  /** Campos opcionales de recálculo (se llenan desde el backend) */
  precioOriginal?: number | null;
  tipoPrecio?: string;
  recalculado?: boolean;
  mensajeRecalculo?: string | null;
}

interface CartRowProps {
  item: CartItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateQty: (cantidad: number) => void;
  onUpdateDiscount: (descuento: number) => void;
  onRemove: () => void;
}

export default function CartRow({ item, isSelected, onSelect, onUpdateQty, onUpdateDiscount, onRemove }: CartRowProps) {
  const handleIncrement = () => {
    onUpdateQty(item.cantidad + 1);
  };

  const handleDecrement = () => {
    if (item.cantidad > 1) {
      onUpdateQty(item.cantidad - 1);
    }
  };

  const isRecalculado = item.recalculado === true;

  return (
    <>
      <tr
        className={`border-b border-border cursor-pointer transition-colors ${
          isRecalculado
            ? 'bg-amber-50 border-l-4 border-l-amber-400'
            : isSelected ? 'bg-blue-50' : 'hover:bg-accent'
        }`}
        onClick={onSelect}
      >
        <td className="py-2 px-3">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
            {item.codigo}
          </span>
        </td>
        <td className="py-2 px-3">
          <p className="text-sm leading-snug">{item.descripcion}</p>
          {item.tipoPrecio === 'MAYOR' && (
            <span className="inline-block text-[10px] font-semibold uppercase bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded mt-0.5">
              Mayor
            </span>
          )}
        </td>
        <td className="py-2 px-3 text-right text-sm">
          {isRecalculado && item.precioOriginal != null && (
            <span className="text-xs line-through text-amber-500 block">RD${item.precioOriginal.toFixed(2)}</span>
          )}
          RD${item.precioUnitario.toFixed(2)}
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDecrement();
              }}
              className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
            >
              <Minus size={12} />
            </button>
            <span className="w-10 text-center text-lg font-bold text-foreground">{item.cantidad}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIncrement();
              }}
              className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </td>
        <td className="py-2 px-3 text-center">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={item.descuentoLinea}
            onChange={(e) => {
              e.stopPropagation();
              onUpdateDiscount(parseFloat(e.target.value) || 0);
            }}
            className="w-16 text-center px-1.5 py-1 border border-border rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        <td className="py-2 px-3 text-right text-sm">RD${item.importe.toFixed(2)}</td>
        <td className="py-2 px-3 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Eliminar"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </td>
      </tr>
      {/* Fila de alerta de recálculo */}
      {isRecalculado && item.mensajeRecalculo && (
        <tr className="bg-amber-50/70">
          <td colSpan={7} className="px-6 py-1.5">
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span>{item.mensajeRecalculo}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

