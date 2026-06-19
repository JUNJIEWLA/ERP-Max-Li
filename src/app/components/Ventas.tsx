import { Plus, Filter, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';

const ventasData = [
  {
    id: 'VT-2026-005',
    cliente: 'Luis Fernández',
    fecha: '01/05/2026 13:30',
    comprobante: 'B01-00001238',
    total: 'RD$ 5,120.00',
    estado: 'Completada',
    tipoPago: 'Tarjeta'
  },
  {
    id: 'VT-2026-004',
    cliente: 'Ana Martínez',
    fecha: '01/05/2026 12:05',
    comprobante: 'B01-00001237',
    total: 'RD$ 850.00',
    estado: 'Completada',
    tipoPago: 'Efectivo'
  },
  {
    id: 'VT-2026-003',
    cliente: 'Carlos Rodríguez',
    fecha: '01/05/2026 11:42',
    comprobante: 'B01-00001236',
    total: 'RD$ 3,890.00',
    estado: 'Pendiente',
    tipoPago: 'Transferencia'
  },
  {
    id: 'VT-2026-002',
    cliente: 'María González',
    fecha: '01/05/2026 10:15',
    comprobante: 'B01-00001235',
    total: 'RD$ 1,230.50',
    estado: 'Completada',
    tipoPago: 'Tarjeta'
  },
  {
    id: 'VT-2026-001',
    cliente: 'Juan Pérez',
    fecha: '01/05/2026 09:23',
    comprobante: 'B01-00001234',
    total: 'RD$ 2,450.00',
    estado: 'Completada',
    tipoPago: 'Efectivo'
  },
];

export default function Ventas() {
  const [selectedEstado, setSelectedEstado] = useState('Todas');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Gestión de Ventas</h2>
          <p className="text-muted-foreground mt-1">Administra todas las transacciones de venta</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus size={20} />
          Nueva Venta
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-muted-foreground" />
              <select
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="px-3 py-2 bg-input-background border border-border rounded-lg"
              >
                <option>Todas</option>
                <option>Completada</option>
                <option>Pendiente</option>
                <option>Anulada</option>
              </select>
            </div>

            <input
              type="date"
              className="px-3 py-2 bg-input-background border border-border rounded-lg"
            />
          </div>

          <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2 hover:opacity-90">
            <Download size={18} />
            Exportar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">ID</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Fecha</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Comprobante</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Tipo Pago</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Estado</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasData.map((venta) => (
                <tr key={venta.id} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 px-4">{venta.id}</td>
                  <td className="py-3 px-4">{venta.cliente}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{venta.fecha}</td>
                  <td className="py-3 px-4 text-sm">{venta.comprobante}</td>
                  <td className="py-3 px-4 text-sm">{venta.tipoPago}</td>
                  <td className="py-3 px-4">{venta.total}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      venta.estado === 'Completada'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {venta.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-accent rounded" title="Ver">
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded" title="Editar">
                        <Edit size={18} className="text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded" title="Eliminar">
                        <Trash2 size={18} className="text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
