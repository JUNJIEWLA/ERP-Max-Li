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
      <td className="py-3 px-4">
        <div>
          <p>{item.descripcion}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.codigo}</p>
        </div>
      </td>
      <td className="py-3 px-4 text-right">RD${item.precioUnitario.toFixed(2)}</td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDecrement();
            }}
            className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="w-12 text-center">{item.cantidad}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleIncrement();
            }}
            className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
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
          className="w-20 text-center px-2 py-1 border border-border rounded"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="py-3 px-4 text-right">RD${item.importe.toFixed(2)}</td>
      <td className="py-3 px-4 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-red-100 rounded transition-colors"
          title="Eliminar"
        >
          <Trash2 size={18} className="text-red-600" />
        </button>
      </td>
    </tr>
  );
}
