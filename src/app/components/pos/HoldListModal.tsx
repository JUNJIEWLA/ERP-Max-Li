import { X, Clock, ShoppingBag, Trash2, PlayCircle } from 'lucide-react';
import { CartItem } from './CartRow';

export interface HeldSale {
  id: number;
  items: CartItem[];
  total: number;
  timestamp: Date;
  clienteNombre: string;
}

interface HoldListModalProps {
  holdList: HeldSale[];
  onResume: (sale: HeldSale) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function HoldListModal({ holdList, onResume, onDelete, onClose }: HoldListModalProps) {
  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatOrderCode = (id: number) => {
    return `ESP-${String(id).slice(-6).padStart(6, '0')}`;
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col overflow-hidden"
           style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold">Lista de Espera</h2>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              {holdList.length} orden{holdList.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {holdList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ShoppingBag size={48} className="mb-3 opacity-20" />
              <p className="text-sm">No hay órdenes en espera</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="text-left py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    Código
                  </th>
                  <th className="text-left py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="text-left py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    Fecha y Hora
                  </th>
                  <th className="text-right py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    Total
                  </th>
                  <th className="text-center py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    Artículos
                  </th>
                  <th className="py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdList.map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/40 transition-colors group">
                    {/* Código */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">
                        {formatOrderCode(sale.id)}
                      </span>
                    </td>

                    {/* Cliente */}
                    <td className="py-3 px-4 font-medium">{sale.clienteNombre}</td>

                    {/* Fecha y Hora */}
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {formatDateTime(sale.timestamp)}
                    </td>

                    {/* Total */}
                    <td className="py-3 px-4 text-right font-semibold text-red-600">
                      RD${sale.total.toFixed(2)}
                    </td>

                    {/* Artículos */}
                    <td className="py-3 px-4 text-center text-muted-foreground text-xs">
                      {sale.items.reduce((s, i) => s + i.cantidad, 0)} art.
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onResume(sale)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                          title="Cargar esta orden en el POS"
                        >
                          <PlayCircle size={13} />
                          Retomar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar la orden ${formatOrderCode(sale.id)}?`)) {
                              onDelete(sale.id);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                          title="Eliminar esta orden"
                        >
                          <Trash2 size={13} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-4">
          <span>Haga clic en <strong>Retomar</strong> para cargar la orden en el POS.</span>
          <span className="ml-auto">Si hay una venta activa, se pausará automáticamente.</span>
        </div>
      </div>
    </div>
  );
}
