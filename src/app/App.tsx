import { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar, { PERMISSION_MAP, primeraVistaPermitida } from './components/Sidebar';
import Header from './components/Header';
import Productos from './components/Productos';
import Inventario from './components/Inventario';
import TurnosCaja from './components/TurnosCaja';
import CajaChica from './components/CajaChica';
import Cajas from './components/Cajas';
import SaleScreen from './components/pos/SaleScreen';
import Ventas from './components/Ventas';
import Devoluciones from './components/Devoluciones';
import Almacenes from './components/Almacenes';
import MovimientosInventario from './components/MovimientosInventario';
import ConteoFisico from './components/ConteoFisico';
import Categorias from './components/Categorias';
import Marcas from './components/Marcas';
import Login from './components/Login';
import Proveedores from './components/Proveedores';
import OrdenesCompra from './components/OrdenesCompra';
import NotasRecepcion from './components/NotasRecepcion';
import Gastos from './components/Gastos';
import Clientes from './components/Clientes';
import Ofertas from './components/Ofertas';
import Usuarios from './components/Usuarios';
import Roles from './components/Roles';
import CambioPasswordObligatorio from './components/CambioPasswordObligatorio';
import NcfDashboard from './components/NcfDashboard';
import Cupones from './components/Cupones';
import ConfiguracionEmpresa from './components/ConfiguracionEmpresa';
import Dashboard from './components/Dashboard';
import Reportes from './components/Reportes';
import { AUTH_EXPIRED_EVENT, authApi } from '../imports/api';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  reportes: 'Reportes',
  pos: 'Punto de Venta',
  'ventas-historial': 'Historial de Ventas',
  devoluciones: 'Devoluciones y Notas de Crédito',
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
  'gastos-pagos-proveedor': 'Gastos / Pagos a Proveedores',
  'turnos-caja': 'Turnos de Caja',
  'caja-chica': 'Caja Chica',
  usuarios: 'Usuarios',
  roles: 'Roles',
  ofertas: 'Ofertas y Promociones',
  ncf: 'Secuencias NCF',
  cupones: 'Gestión de Cupones',
  'cajas-registradoras': 'Cajas Registradoras',
  'configuracion-empresa': 'Información de la Empresa',
};

/** Vista vacía: el usuario está autenticado pero sin ningún módulo asignado. */
const SIN_MODULOS = '';

export default function App() {
  // Sin sesión todavía no se conocen los permisos, así que no hay vista activa;
  // se resuelve al iniciar sesión o al recuperar la sesión existente.
  const [activeView, setActiveView] = useState(SIN_MODULOS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loginNotice, setLoginNotice] = useState('');
  // La sesión vive en una cookie HttpOnly: este código no puede inspeccionarla,
  // así que arranca sin sesión y se la pregunta al backend en el primer efecto.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [username, setUsername] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userPermisos, setUserPermisos] = useState<string[]>([]);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  // Ref to track active view for use inside polling callback
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const clearSessionState = useCallback(() => {
    setIsAuthenticated(false);
    setUsername('');
    setUserRoles([]);
    setUserPermisos([]);
    setRequiresPasswordChange(false);
    setActiveView(SIN_MODULOS);
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => clearSessionState();

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, [clearSessionState]);

  const [isSlowLoading, setIsSlowLoading] = useState(false);

  // ── Recuperación de sesión al cargar o recargar la página ──
  useEffect(() => {
    let cancelado = false;
    const slowTimer = setTimeout(() => {
      if (!cancelado) setIsSlowLoading(true);
    }, 3000);

    authApi.recuperarSesion().then(sesion => {
      if (cancelado) return;
      clearTimeout(slowTimer);
      if (sesion) {
        const permisos = sesion.permisos ?? [];
        setUsername(sesion.username);
        setUserRoles(sesion.roles ?? []);
        setUserPermisos(permisos);
        setRequiresPasswordChange(sesion.requiereCambioPassword);
        setActiveView(primeraVistaPermitida(permisos) ?? SIN_MODULOS);
        setIsAuthenticated(true);
      }
      setSessionChecked(true);
    });

    return () => {
      cancelado = true;
      clearTimeout(slowTimer);
    };
  }, []);

  const handleLogin = (user: string, roles: string[], permisos: string[], requiresPwdChange: boolean) => {
    setLoginNotice('');
    setUsername(user);
    setUserRoles(roles);
    setUserPermisos(permisos);
    setRequiresPasswordChange(requiresPwdChange);
    setActiveView(primeraVistaPermitida(permisos) ?? SIN_MODULOS);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setLoginNotice('');
    // El backend es quien borra la cookie; si la llamada falla igualmente se
    // limpia la pantalla para no dejar una sesión aparente sin respaldo.
    authApi.logout().catch(() => undefined).finally(clearSessionState);
  };

  const handlePasswordChangeSuccess = () => {
    // El cambio de contraseña invalida el token en curso y borra la cookie.
    clearSessionState();
    setLoginNotice('Contraseña actualizada. Inicia sesión nuevamente con tu contraseña nueva.');
  };

  // ── Polling de permisos cada 30s para actualización en tiempo real ──
  const pollPermisos = useCallback(async () => {
    try {
      const data = await authApi.me();
      const newPermisos = Array.isArray(data.permisos) ? [...data.permisos].sort() : [];

      setUserPermisos(actuales => {
        const ordenados = [...actuales].sort();
        const changed = newPermisos.length !== ordenados.length ||
          newPermisos.some((p, i) => p !== ordenados[i]);
        if (!changed) return actuales;

        // Si el usuario está en una vista sobre la que perdió permiso, se le
        // lleva a la primera vista real que todavía puede abrir.
        const requiredPerm = PERMISSION_MAP[activeViewRef.current];
        if (requiredPerm && !newPermisos.includes(requiredPerm)) {
          setActiveView(primeraVistaPermitida(newPermisos) ?? SIN_MODULOS);
        }
        return newPermisos;
      });

      const newRoles = Array.isArray(data.roles) ? [...data.roles].sort() : [];
      setUserRoles(actuales => {
        const ordenados = [...actuales].sort();
        const changed = newRoles.length !== ordenados.length ||
          newRoles.some((r, i) => r !== ordenados[i]);
        return changed ? newRoles : actuales;
      });
    } catch {
      // Silently ignore polling errors (e.g., network issues)
      // If the session expired, the 401 handler fires AUTH_EXPIRED_EVENT
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || requiresPasswordChange) return;
    const interval = setInterval(pollPermisos, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, requiresPasswordChange, pollPermisos]);

  // ── Comprobación inicial de sesión en curso ─────────────
  if (!sessionChecked) {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
        <span className="login-spinner" />
        <p className="text-sm font-medium text-foreground">Cargando sistema MAX ERP...</p>
        {isSlowLoading && (
          <p className="text-xs text-muted-foreground max-w-sm animate-fade-in">
            El servidor (Render) se está iniciando tras estar inactivo. Esto puede demorar entre 30 y 60 segundos la primera vez...
          </p>
        )}
      </div>
    );
  }

  // ── Pantalla de login ───────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} notice={loginNotice} />;
  }

  // ── Pantalla de cambio de contraseña obligatorio ────────
  if (requiresPasswordChange) {
    return <CambioPasswordObligatorio username={username} onSuccess={handlePasswordChangeSuccess} onLogout={handleLogout} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'reportes':
        return <Reportes />;
      case 'pos':
        return <SaleScreen username={username} canOpenTurno={userPermisos.includes('CAJA_OPERAR')} userRoles={userRoles} />;
      case 'ventas-historial':
        return <Ventas />;
      case 'devoluciones':
        return <Devoluciones userPermisos={userPermisos} />;
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
        return <TurnosCaja username={username} userPermisos={userPermisos} />;
      case 'caja-chica':
        return <CajaChica />;
      case 'cajas-registradoras':
        return <Cajas />;
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
      case 'gastos-pagos-proveedor':
        return <Gastos />;
      case 'usuarios':
        return <Usuarios />;
      case 'roles':
        return <Roles />;
      case 'ncf':
        return <NcfDashboard />;
      case 'cupones':
        return <Cupones />;
      case 'configuracion-empresa':
        return <ConfiguracionEmpresa />;
      default:
        // Todas las opciones del menú tienen su `case`; aquí solo cae el usuario
        // autenticado sin ningún módulo asignado.
        return (
          <div className="p-6 h-full flex flex-col items-center justify-center text-center">
            <h2 className="text-foreground">No tienes módulos asignados</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Tu usuario no tiene permisos sobre ninguna sección del sistema.
              Contacta al administrador para que te asigne un rol.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="size-full flex bg-background">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        username={username}
        userRoles={userRoles}
        userPermisos={userPermisos}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={viewTitles[activeView] || 'MAX ERP'}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(false)}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
