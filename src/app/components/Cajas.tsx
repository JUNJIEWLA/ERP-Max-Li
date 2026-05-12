import { DollarSign, CreditCard, Wallet, TrendingUp } from 'lucide-react';

const cajasActivas = [
  {
    id: 'CAJA-01',
    nombre: 'Caja Principal',
    cajero: 'María González',
    turno: 'Turno 1 - Mañana',
    apertura: '08:00 AM',
    montoInicial: 'RD$ 5,000.00',
    ventasEfectivo: 'RD$ 12,450.00',
    ventasTarjeta: 'RD$ 8,230.00',
    total: 'RD$ 20,680.00',
    estado: 'Abierta'
  },
  {
    id: 'CAJA-02',
    nombre: 'Caja Sucursal 1',
    cajero: 'Juan Pérez',
    turno: 'Turno 1 - Mañana',
    apertura: '08:00 AM',
    montoInicial: 'RD$ 3,000.00',
    ventasEfectivo: 'RD$ 8,920.00',
    ventasTarjeta: 'RD$ 6,450.00',
    total: 'RD$ 15,370.00',
    estado: 'Abierta'
  },
  {
    id: 'CAJA-03',
    nombre: 'Caja Sucursal 2',
    cajero: 'Carlos Rodríguez',
    turno: 'Turno 1 - Mañana',
    apertura: '08:00 AM',
    montoInicial: 'RD$ 3,000.00',
    ventasEfectivo: 'RD$ 5,680.00',
    ventasTarjeta: 'RD$ 4,120.00',
    total: 'RD$ 9,800.00',
    estado: 'Abierta'
  },
];

const cajasChicas = [
  { nombre: 'Caja Chica Admin', saldo: 'RD$ 8,500.00', responsable: 'Admin', limite: 'RD$ 10,000.00' },
  { nombre: 'Caja Chica Compras', saldo: 'RD$ 4,200.00', responsable: 'Gerente Compras', limite: 'RD$ 5,000.00' },
  { nombre: 'Caja Chica Limpieza', saldo: 'RD$ 1,800.00', responsable: 'Supervisor', limite: 'RD$ 3,000.00' },
];

const movimientosCaja = [
  { tipo: 'Venta', concepto: 'Venta VT-2026-001', monto: '+RD$ 2,450.00', fecha: '01/05/2026 09:23', caja: 'CAJA-01' },
  { tipo: 'Retiro', concepto: 'Retiro para banco', monto: '-RD$ 10,000.00', fecha: '01/05/2026 10:00', caja: 'CAJA-01' },
  { tipo: 'Venta', concepto: 'Venta VT-2026-002', monto: '+RD$ 1,230.50', fecha: '01/05/2026 10:15', caja: 'CAJA-01' },
  { tipo: 'Gasto', concepto: 'Compra suministros', monto: '-RD$ 850.00', fecha: '01/05/2026 11:00', caja: 'Caja Chica Admin' },
  { tipo: 'Venta', concepto: 'Venta VT-2026-003', monto: '+RD$ 3,890.00', fecha: '01/05/2026 11:42', caja: 'CAJA-01' },
];

export default function Cajas() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2>Gestión de Cajas</h2>
        <p className="text-muted-foreground mt-1">Control de cajas registradoras y cajas chicas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total en Cajas</p>
              <p className="text-2xl mt-1">RD$ 45,850</p>
            </div>
            <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center text-white">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Ventas Efectivo</p>
              <p className="text-2xl mt-1">RD$ 27,050</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <Wallet size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Ventas Tarjeta</p>
              <p className="text-2xl mt-1">RD$ 18,800</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white">
              <CreditCard size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Cajas Activas</p>
              <p className="text-2xl mt-1">3</p>
            </div>
            <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="mb-4">Cajas Registradoras Activas</h3>
        <div className="space-y-4">
          {cajasActivas.map((caja) => (
            <div key={caja.id} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4>{caja.nombre}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {caja.cajero} - {caja.turno}
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  {caja.estado}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Apertura</p>
                  <p className="text-sm mt-1">{caja.apertura}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Inicial</p>
                  <p className="text-sm mt-1">{caja.montoInicial}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="text-sm mt-1 text-green-600">{caja.ventasEfectivo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarjeta</p>
                  <p className="text-sm mt-1 text-blue-600">{caja.ventasTarjeta}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm mt-1">{caja.total}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                  Ver Detalles
                </button>
                <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm">
                  Cerrar Caja
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Cajas Chicas</h3>
          <div className="space-y-3">
            {cajasChicas.map((cajaChica, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm">{cajaChica.nombre}</h4>
                  <p className="text-sm">{cajaChica.saldo}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Responsable: {cajaChica.responsable}</span>
                  <span>Límite: {cajaChica.limite}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-3">
                  <div
                    className="bg-chart-1 h-2 rounded-full"
                    style={{ width: `${(parseFloat(cajaChica.saldo.replace(/[^\d.]/g, '')) / parseFloat(cajaChica.limite.replace(/[^\d.]/g, ''))) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="mb-4">Últimos Movimientos</h3>
          <div className="space-y-3">
            {movimientosCaja.map((mov, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      mov.tipo === 'Venta'
                        ? 'bg-green-100 text-green-700'
                        : mov.tipo === 'Retiro'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {mov.tipo}
                    </span>
                    <p className="text-sm">{mov.concepto}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mov.caja} - {mov.fecha}
                  </p>
                </div>
                <p className={`text-sm ${mov.monto.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {mov.monto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
