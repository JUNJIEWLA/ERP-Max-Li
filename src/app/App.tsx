import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Ventas from './components/Ventas';
import Productos from './components/Productos';
import Inventario from './components/Inventario';
import TurnosCaja from './components/TurnosCaja';
import CajaChica from './components/CajaChica';
import Devoluciones from './components/Devoluciones';
import SaleScreen from './components/pos/SaleScreen';
import Almacenes from './components/Almacenes';
import MovimientosInventario from './components/MovimientosInventario';
import Categorias from './components/Categorias';
import Marcas from './components/Marcas';
import Login from './components/Login';
import Proveedores from './components/Proveedores';
import OrdenesCompra from './components/OrdenesCompra';
import NotasRecepcion from './components/NotasRecepcion';
import Clientes from './components/Clientes';
import { AUTH_EXPIRED_EVENT, setToken, clearToken, hasValidToken } from '../imports/api';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  pos: 'Punto de Venta',
  'ventas-historial': 'Historial de Ventas',
  'notas-credito': 'Notas de Crédito',
  devoluciones: 'Devoluciones',
  clientes: 'Gestión de Clientes',
  productos: 'Catálogo de Productos',
  existencias: 'Control de Existencias',
  movimientos: 'Movimientos de Inventario',
  categorias: 'Categorías',
  marcas: 'Marcas',
  almacenes: 'Almacenes',
  'ordenes-compra': 'Órdenes de Compra',
  'notas-recepcion': 'Notas de Recepción',
  proveedores: 'Proveedores',
  'pagos-proveedor': 'Pagos a Proveedores',
  'turnos-caja': 'Turnos de Caja',
  'movimientos-caja': 'Movimientos de Caja',
  'caja-chica': 'Caja Chica',
  usuarios: 'Usuarios',
  roles: 'Roles',
  ofertas: 'Ofertas y Promociones',
  ncf: 'Secuencias NCF',
  'cajas-registradoras': 'Cajas Registradoras',
};

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  // Inicializar sesión desde localStorage si ya hay token guardado
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidToken());
  const [username, setUsername] = useState(() => (hasValidToken() ? localStorage.getItem('maxli_user') || '' : ''));

  useEffect(() => {
    const handleExpiredSession = () => {
      setIsAuthenticated(false);
      setUsername('');
      setActiveView('dashboard');
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const handleLogin = (token: string, user: string) => {
    setToken(token);
    localStorage.setItem('maxli_user', user);
    setUsername(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('maxli_user');
    setIsAuthenticated(false);
    setUsername('');
    setActiveView('dashboard');
  };

  // ── Pantalla de login ───────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'pos':
        return <SaleScreen />;
      case 'ventas-historial':
        return <Ventas />;
      case 'productos':
        return <Productos />;
      case 'existencias':
        return <Inventario />;
      case 'almacenes':
        return <Almacenes />;
      case 'categorias':
        return <Categorias />;
      case 'marcas':
        return <Marcas />;
      case 'movimientos':
        return <MovimientosInventario />;
      case 'turnos-caja':
        return <TurnosCaja />;
      case 'caja-chica':
        return <CajaChica />;
      case 'devoluciones':
        return <Devoluciones />;
      case 'proveedores':
        return <Proveedores />;
      case 'clientes':
        return <Clientes />;
      case 'ordenes-compra':
        return <OrdenesCompra />;
      case 'notas-recepcion':
        return <NotasRecepcion />;
      default:
        return (
          <div className="p-6">
            <h2>{viewTitles[activeView]}</h2>
            <p className="text-muted-foreground mt-2">Esta sección está en desarrollo.</p>
          </div>
        );
    }
  };

  return (
    <div className="size-full flex bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} username={username} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={viewTitles[activeView] || 'ERP Sistema'} />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
