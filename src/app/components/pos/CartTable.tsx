import CartRow, { CartItem } from './CartRow';
import { ShoppingCart } from 'lucide-react';

interface CartTableProps {
  items: CartItem[];
  selectedRowIndex: number;
  onSelectRow: (index: number) => void;
  onUpdateQty: (index: number, cantidad: number) => void;
  onUpdateDiscount: (index: number, descuento: number) => void;
  onRemoveItem: (index: number) => void;
}

export default function CartTable({ items, selectedRowIndex, onSelectRow, onUpdateQty, onUpdateDiscount, onRemoveItem }: CartTableProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-background border-b border-border">
          <tr>
            <th className="text-left py-2 px-3 text-muted-foreground text-sm">Descripción</th>
            <th className="text-right py-2 px-3 text-muted-foreground text-sm">Precio unit.</th>
            <th className="text-center py-2 px-3 text-muted-foreground text-sm">Cant.</th>
            <th className="text-center py-2 px-3 text-muted-foreground text-sm">Desc./línea</th>
            <th className="text-right py-2 px-3 text-muted-foreground text-sm">Importe</th>
            <th className="text-center py-2 px-3 text-muted-foreground text-sm"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-20 text-center text-muted-foreground">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay productos. Use la búsqueda para agregar.</p>
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <CartRow
                key={item.id}
                item={item}
                isSelected={selectedRowIndex === index}
                onSelect={() => onSelectRow(index)}
                onUpdateQty={(cantidad) => onUpdateQty(index, cantidad)}
                onUpdateDiscount={(descuento) => onUpdateDiscount(index, descuento)}
                onRemove={() => onRemoveItem(index)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
