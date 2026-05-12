import { useState } from 'react';
import { Plus, Search, Eye, FileText, X, CheckCircle } from 'lucide-react';

interface DetalleDevolucion {
  idDetalleVenta: number;
  producto: string;
  codigo: string;
  cantidadOriginal: number;
  cantidadDevolver: number;
  precioUnitario: number;
  subtotal: number;
}

const devolucionesData = [
  {
    idDevolucion: 'DEV-2026-001',
    idVenta: 'VT-2026-001',
    idNotaCredito: 'NC-B04-00000123',
    cliente: 'Juan Pérez',
    fecha: '01/05/2026 14:30',
    motivo: 'Producto defectuoso',
    total: 'RD$ 2,450.00',
    estado: 'Aprobada',
    usuario: 'Admin'
  },
  {
    idDevolucion: 'DEV-2026-002',
    idVenta: 'VT-2026-005',
    idNotaCredito: 'NC-B04-00000124',
    cliente: 'Luis Fernández',
    fecha: '30/04/2026 11:20',
    motivo: 'Cliente insatisfecho',
    total: 'RD$ 1,200.00',
    estado: 'Aprobada',
    usuario: 'Gerente'
  },
  {
    idDevolucion: 'DEV-2026-003',
    idVenta: 'VT-2026-003',
    idNotaCredito: 'Pendiente',
    cliente: 'Carlos Rodríguez',
    fecha: '01/05/2026 16:00',
    motivo: 'Error en pedido',
    total: 'RD$ 850.00',
    estado: 'Pendiente',
    usuario: 'Vendedor 2'
  },
];

const ventaEjemplo = {
  id: 'VT-2026-001',
  cliente: 'Juan Pérez',
  fecha: '28/04/2026 10:30',
  comprobante: 'B01-00001234',
  total: 'RD$ 2,450.00',
  detalles: [
    {
      idDetalleVenta: 1,
      codigo: 'PROD-001',
      producto: 'Laptop Dell Inspiron 15',
      cantidad: 1,
      precioUnitario: 32500,
      subtotal: 32500
    },
    {
      idDetalleVenta: 2,
      codigo: 'PROD-045',
      producto: 'Mouse Inalámbrico',
      cantidad: 2,
      precioUnitario: 450,
      subtotal: 900
    }
  ]
};

export default function Devoluciones() {
  const [showModal, setShowModal] = useState(false);
  const [paso, setPaso] = useState(1);
  const [ventaBuscada, setVentaBuscada] = useState('');
  const [ventaSeleccionada, setVentaSeleccionada] = useState<typeof ventaEjemplo | null>(null);
  const [productosDevolver, setProductosDevolver] = useState<DetalleDevolucion[]>([]);
  const [motivo, setMotivo] = useState('');
  const [ncfSecuencia, setNcfSecuencia] = useState('NC-B04-00000125');

  const buscarVenta = () => {
    setVentaSeleccionada(ventaEjemplo);
    setProductosDevolver(ventaEjemplo.detalles.map(d => ({
      idDetalleVenta: d.idDetalleVenta,
      producto: d.producto,
      codigo: d.codigo,
      cantidadOriginal: d.cantidad,
      cantidadDevolver: 0,
      precioUnitario: d.precioUnitario,
      subtotal: 0
    })));
    setPaso(2);
  };

  const actualizarCantidad = (idDetalle: number, cantidad: number) => {
    setProductosDevolver(prev => prev.map(p =>
      p.idDetalleVenta === idDetalle
        ? { ...p, cantidadDevolver: cantidad, subtotal: cantidad * p.precioUnitario }
        : p
    ));
  };

  const calcularTotal = () => {
    return productosDevolver.reduce((sum, p) => sum + p.subtotal, 0);
  };

  const procesarDevolucion = () => {
    setPaso(3);
  };

  const confirmarNotaCredito = () => {
    alert('Nota de Crédito ' + ncfSecuencia + ' generada exitosamente');
    setShowModal(false);
    setPaso(1);
    setVentaSeleccionada(null);
    setProductosDevolver([]);
    setMotivo('');
  };

  const resetModal = () => {
    setShowModal(false);
    setPaso(1);
    setVentaSeleccionada(null);
    setProductosDevolver([]);
    setMotivo('');
    setVentaBuscada('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Devoluciones y Notas de Crédito</h2>
          <p className="text-muted-foreground mt-1">Gestiona devoluciones y emisión de notas de crédito fiscales</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={20} />
          Nueva Devolución
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Devoluciones Hoy</p>
          <p className="text-2xl mt-1">3</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Total Devuelto Hoy</p>
          <p className="text-2xl mt-1">RD$ 4,500</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">NC Emitidas</p>
          <p className="text-2xl mt-1">124</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Pendientes</p>
          <p className="text-2xl mt-1 text-yellow-600">1</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="mb-4">Historial de Devoluciones</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">ID Devolución</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Venta Original</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Nota de Crédito</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Fecha</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Motivo</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Estado</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {devolucionesData.map((dev) => (
                <tr key={dev.idDevolucion} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 px-4">{dev.idDevolucion}</td>
                  <td className="py-3 px-4 text-blue-600">{dev.idVenta}</td>
                  <td className="py-3 px-4">
                    <span className={dev.idNotaCredito === 'Pendiente' ? 'text-yellow-600' : 'text-green-600'}>
                      {dev.idNotaCredito}
                    </span>
                  </td>
                  <td className="py-3 px-4">{dev.cliente}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{dev.fecha}</td>
                  <td className="py-3 px-4 text-sm">{dev.motivo}</td>
                  <td className="py-3 px-4">{dev.total}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      dev.estado === 'Aprobada'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {dev.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-accent rounded" title="Ver">
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded" title="Imprimir NC">
                        <FileText size={18} className="text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3>Nueva Devolución</h3>
                <div className="flex items-center gap-4 mt-3">
                  <div className={`flex items-center gap-2 ${paso >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paso >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>1</div>
                    <span className="text-sm">Buscar Venta</span>
                  </div>
                  <div className="w-12 h-0.5 bg-border"></div>
                  <div className={`flex items-center gap-2 ${paso >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paso >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>2</div>
                    <span className="text-sm">Seleccionar Productos</span>
                  </div>
                  <div className="w-12 h-0.5 bg-border"></div>
                  <div className={`flex items-center gap-2 ${paso >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paso >= 3 ? 'bg-primary text-white' : 'bg-muted'}`}>3</div>
                    <span className="text-sm">Nota de Crédito</span>
                  </div>
                </div>
              </div>
              <button onClick={resetModal} className="p-2 hover:bg-accent rounded-lg">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {paso === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2">Buscar Venta por ID o Comprobante</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ventaBuscada}
                        onChange={(e) => setVentaBuscada(e.target.value)}
                        placeholder="Ej: VT-2026-001 o B01-00001234"
                        className="flex-1 px-4 py-2 bg-input-background border border-border rounded-lg"
                      />
                      <button
                        onClick={buscarVenta}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2"
                      >
                        <Search size={20} />
                        Buscar
                      </button>
                    </div>
                  </div>

                  <div className="bg-muted/50 border border-border rounded-lg p-4 mt-6">
                    <p className="text-sm text-muted-foreground">
                      <strong>Nota:</strong> Ingresa el ID de la venta o número de comprobante fiscal para iniciar el proceso de devolución.
                      La venta debe estar completada y dentro del período permitido para devoluciones.
                    </p>
                  </div>
                </div>
              )}

              {paso === 2 && ventaSeleccionada && (
                <div className="space-y-4">
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <h4 className="mb-3">Información de la Venta</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">ID Venta</p>
                        <p className="mt-1">{ventaSeleccionada.id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliente</p>
                        <p className="mt-1">{ventaSeleccionada.cliente}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fecha</p>
                        <p className="mt-1">{ventaSeleccionada.fecha}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Comprobante</p>
                        <p className="mt-1">{ventaSeleccionada.comprobante}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2">Motivo de la Devolución</label>
                    <select
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                    >
                      <option value="">Seleccione un motivo...</option>
                      <option value="Producto defectuoso">Producto defectuoso</option>
                      <option value="Error en pedido">Error en pedido</option>
                      <option value="Cliente insatisfecho">Cliente insatisfecho</option>
                      <option value="Cambio de producto">Cambio de producto</option>
                      <option value="Garantía">Garantía</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <h4 className="mb-3">Productos a Devolver</h4>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left py-3 px-4 text-muted-foreground">Código</th>
                            <th className="text-left py-3 px-4 text-muted-foreground">Producto</th>
                            <th className="text-left py-3 px-4 text-muted-foreground">Cant. Original</th>
                            <th className="text-left py-3 px-4 text-muted-foreground">Cant. a Devolver</th>
                            <th className="text-left py-3 px-4 text-muted-foreground">Precio Unit.</th>
                            <th className="text-left py-3 px-4 text-muted-foreground">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productosDevolver.map((prod) => (
                            <tr key={prod.idDetalleVenta} className="border-t border-border">
                              <td className="py-3 px-4">{prod.codigo}</td>
                              <td className="py-3 px-4">{prod.producto}</td>
                              <td className="py-3 px-4">{prod.cantidadOriginal}</td>
                              <td className="py-3 px-4">
                                <input
                                  type="number"
                                  min="0"
                                  max={prod.cantidadOriginal}
                                  value={prod.cantidadDevolver}
                                  onChange={(e) => actualizarCantidad(prod.idDetalleVenta, parseInt(e.target.value) || 0)}
                                  className="w-20 px-3 py-1 bg-input-background border border-border rounded"
                                />
                              </td>
                              <td className="py-3 px-4">RD$ {prod.precioUnitario.toLocaleString()}</td>
                              <td className="py-3 px-4">RD$ {prod.subtotal.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted border-t-2 border-border">
                          <tr>
                            <td colSpan={5} className="py-3 px-4 text-right">
                              <strong>Total a Devolver:</strong>
                            </td>
                            <td className="py-3 px-4">
                              <strong>RD$ {calcularTotal().toLocaleString()}</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setPaso(1)}
                      className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={procesarDevolucion}
                      disabled={calcularTotal() === 0 || !motivo}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {paso === 3 && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle size={48} className="text-green-600 mx-auto mb-3" />
                    <h4 className="text-green-800 mb-2">Devolución Procesada</h4>
                    <p className="text-sm text-green-700">La devolución ha sido aprobada. Proceda a generar la Nota de Crédito.</p>
                  </div>

                  <div className="bg-card border-2 border-primary rounded-lg p-6">
                    <h4 className="mb-4">Emisión de Nota de Crédito (NCF)</h4>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo de Comprobante</p>
                        <p className="mt-1">B04 - Nota de Crédito</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Secuencia NCF</p>
                        <p className="mt-1 text-primary">{ncfSecuencia}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Comprobante Original</p>
                        <p className="mt-1">{ventaSeleccionada?.comprobante}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fecha Emisión</p>
                        <p className="mt-1">{new Date().toLocaleDateString('es-DO')}</p>
                      </div>
                    </div>

                    <div className="bg-muted rounded-lg p-4 mb-4">
                      <h5 className="text-sm mb-3">Resumen de la Devolución</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Cliente:</span>
                          <span>{ventaSeleccionada?.cliente}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Motivo:</span>
                          <span>{motivo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Productos devueltos:</span>
                          <span>{productosDevolver.filter(p => p.cantidadDevolver > 0).length}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span><strong>Total NC:</strong></span>
                          <span><strong>RD$ {calcularTotal().toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Información Fiscal:</strong> Esta Nota de Crédito será reportada a la DGII según la normativa
                        vigente. El NCF {ncfSecuencia} quedará asociado a esta transacción y el inventario será ajustado automáticamente.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setPaso(2)}
                      className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={confirmarNotaCredito}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"
                    >
                      <FileText size={20} />
                      Generar Nota de Crédito
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
