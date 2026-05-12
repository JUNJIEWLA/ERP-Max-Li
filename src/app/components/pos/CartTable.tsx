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
        <thead className="sticky top-0 bg-background border-b-2 border-border">
          <tr>
            <th className="text-left py-3 px-4 text-muted-foreground">Descripción</th>
            <th className="text-right py-3 px-4 text-muted-foreground">Precio unit.</th>
            <th className="text-center py-3 px-4 text-muted-foreground">Cant.</th>
            <th className="text-center py-3 px-4 text-muted-foreground">Desc./línea</th>
            <th className="text-right py-3 px-4 text-muted-foreground">Importe</th>
            <th className="text-center py-3 px-4 text-muted-foreground"></th>
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
