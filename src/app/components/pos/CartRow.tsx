import { Minus, Plus, Trash2 } from 'lucide-react';

export interface CartItem {
  id: number;
  codigo: string;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  descuentoLinea: number;
  unidad: string;
  importe: number;
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

  return (
    <tr
      className={`border-b border-border cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-accent'
      }`}
      onClick={onSelect}
    >
      <td className="py-2 px-3">
        <div>
          <p className="text-sm">{item.descripcion}</p>
          <p className="text-xs text-muted-foreground">{item.codigo}</p>
        </div>
      </td>
      <td className="py-2 px-3 text-right text-sm">RD${item.precioUnitario.toFixed(2)}</td>
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
          <span className="w-10 text-center text-sm">{item.cantidad}</span>
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
  );
}
