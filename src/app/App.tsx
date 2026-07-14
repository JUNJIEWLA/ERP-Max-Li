import { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar, { PERMISSION_MAP } from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Ventas from './components/Ventas';
import Productos from './components/Productos';
import Inventario from './components/Inventario';
import TurnosCaja from './components/TurnosCaja';
import CajaChica from './components/CajaChica';
import Cajas from './components/Cajas';
import Devoluciones from './components/Devoluciones';
import SaleScreen from './components/pos/SaleScreen';
import Almacenes from './components/Almacenes';
import MovimientosInventario from './components/MovimientosInventario';
import ConteoFisico from './components/ConteoFisico';
import Categorias from './components/Categorias';
import Marcas from './components/Marcas';
import Login from './components/Login';
import Proveedores from './components/Proveedores';
import OrdenesCompra from './components/OrdenesCompra';
import NotasRecepcion from './components/NotasRecepcion';
import Clientes from './components/Clientes';
import Ofertas from './components/Ofertas';
import Usuarios from './components/Usuarios';
import Roles from './components/Roles';
import CambioPasswordObligatorio from './components/CambioPasswordObligatorio';
import NcfDashboard from './components/NcfDashboard';
import Cupones from './components/Cupones';
import { AUTH_EXPIRED_EVENT, authApi, setToken, clearToken, hasValidToken } from '../imports/api';

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
  'conteo-fisico': 'Conteo Físico',
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
  cupones: 'Gestión de Cupones',
  'cajas-registradoras': 'Cajas Registradoras',
};

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  // Inicializar sesión desde localStorage si ya hay token guardado
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidToken());
  const [username, setUsername] = useState(() => (hasValidToken() ? localStorage.getItem('maxli_user') || '' : ''));
  const [userRoles, setUserRoles] = useState<string[]>(() => {
    const rolesStr = localStorage.getItem('maxli_roles');
    return rolesStr ? JSON.parse(rolesStr) : [];
  });
  const [userPermisos, setUserPermisos] = useState<string[]>(() => {
    const permStr = localStorage.getItem('maxli_permisos');
    return permStr ? JSON.parse(permStr) : [];
  });
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(() => localStorage.getItem('maxli_pwd_change') === 'true');

  // Ref to track active view for use inside polling callback
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  useEffect(() => {
    const handleExpiredSession = () => {
      setIsAuthenticated(false);
      setUsername('');
      setUserRoles([]);
      setUserPermisos([]);
      setRequiresPasswordChange(false);
      setActiveView('dashboard');
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const handleLogin = (token: string, user: string, roles: string[], permisos: string[], requiresPwdChange: boolean) => {
    setToken(token);
    localStorage.setItem('maxli_user', user);
    localStorage.setItem('maxli_roles', JSON.stringify(roles));
    localStorage.setItem('maxli_permisos', JSON.stringify(permisos));
    if (requiresPwdChange) {
      localStorage.setItem('maxli_pwd_change', 'true');
    } else {
      localStorage.removeItem('maxli_pwd_change');
    }
    setUsername(user);
    setUserRoles(roles);
    setUserPermisos(permisos);
    setRequiresPasswordChange(requiresPwdChange);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('maxli_user');
    localStorage.removeItem('maxli_roles');
    localStorage.removeItem('maxli_permisos');
    localStorage.removeItem('maxli_pwd_change');
    setIsAuthenticated(false);
    setUsername('');
    setUserRoles([]);
    setUserPermisos([]);
    setRequiresPasswordChange(false);
    setActiveView('dashboard');
  };

  const handlePasswordChangeSuccess = () => {
    localStorage.removeItem('maxli_pwd_change');
    setRequiresPasswordChange(false);
  };

  // ── Polling de permisos cada 30s para actualización en tiempo real ──
  const pollPermisos = useCallback(async () => {
    if (!hasValidToken()) return;
    try {
      const data = await authApi.me();
      const newPermisos = Array.isArray(data.permisos) ? data.permisos.sort() : [];
      const currentPermisos = JSON.parse(localStorage.getItem('maxli_permisos') || '[]').sort();

      // Compare permissions
      const changed = newPermisos.length !== currentPermisos.length ||
        newPermisos.some((p: string, i: number) => p !== currentPermisos[i]);

      if (changed) {
        localStorage.setItem('maxli_permisos', JSON.stringify(newPermisos));
        setUserPermisos(newPermisos);

        // If the user is on a view they no longer have access to, redirect to dashboard
        const currentView = activeViewRef.current;
        const requiredPerm = PERMISSION_MAP[currentView];
        if (requiredPerm && !newPermisos.includes(requiredPerm)) {
          setActiveView('dashboard');
        }
      }

      // Also update roles if changed
      const newRoles = Array.isArray(data.roles) ? data.roles.sort() : [];
      const currentRoles = JSON.parse(localStorage.getItem('maxli_roles') || '[]').sort();
      const rolesChanged = newRoles.length !== currentRoles.length ||
        newRoles.some((r: string, i: number) => r !== currentRoles[i]);
      if (rolesChanged) {
        localStorage.setItem('maxli_roles', JSON.stringify(newRoles));
        setUserRoles(newRoles);
      }
    } catch {
      // Silently ignore polling errors (e.g., network issues)
      // If token expired, the 401 handler will fire AUTH_EXPIRED_EVENT
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || requiresPasswordChange) return;
    // Poll immediately on mount, then every 30 seconds
    pollPermisos();
    const interval = setInterval(pollPermisos, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, requiresPasswordChange, pollPermisos]);

  // ── Pantalla de login ───────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // ── Pantalla de cambio de contraseña obligatorio ────────
  if (requiresPasswordChange) {
    return <CambioPasswordObligatorio username={username} onSuccess={handlePasswordChangeSuccess} onLogout={handleLogout} />;
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
      case 'conteo-fisico':
        return <ConteoFisico />;
      case 'turnos-caja':
        return <TurnosCaja />;
      case 'caja-chica':
        return <CajaChica />;
      case 'cajas-registradoras':
        return <Cajas />;
      case 'devoluciones':
        return <Devoluciones />;
      case 'proveedores':
        return <Proveedores />;
      case 'clientes':
        return <Clientes />;
      case 'ofertas':
        return <Ofertas />;
      case 'ordenes-compra':
        return <OrdenesCompra />;
      case 'notas-recepcion':
        return <NotasRecepcion />;
      case 'usuarios':
        return <Usuarios />;
      case 'roles':
        return <Roles />;
      case 'ncf':
        return <NcfDashboard />;
      case 'cupones':
        return <Cupones />;
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
      <Sidebar activeView={activeView} onViewChange={setActiveView} username={username} userRoles={userRoles} userPermisos={userPermisos} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={viewTitles[activeView] || 'ERP Sistema'} />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
