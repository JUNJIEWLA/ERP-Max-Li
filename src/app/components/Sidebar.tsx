import { useState } from 'react';
import { LogOut } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  CreditCard,
  Settings,
  Truck,
  BarChart3,
  Tag,
  RotateCcw,
  Monitor,
  FileText,
  Wallet,
  ChevronDown,
  ChevronRight,
  UserCircle,
  ClipboardList,
  ClipboardCheck,
  Archive,
  TrendingUp,
  Receipt
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  username?: string;
  userRoles?: string[];
  userPermisos?: string[];
  onLogout?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  requiredPermission?: string;
}

interface MenuSection {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

/**
 * Maps sidebar item IDs to their required permission (nombreClave).
 * Exported so App.tsx can check if the active view requires a permission.
 * Items not in this map (like 'dashboard') are always visible.
 */
export const PERMISSION_MAP: Record<string, string> = {
  pos: 'VENTA_CREAR',
  'ventas-historial': 'VENTA_VER',
  devoluciones: 'DEVOLUCION_CREAR',
  'notas-credito': 'DEVOLUCION_CREAR',
  clientes: 'CLIENTE_GESTIONAR',
  productos: 'PRODUCTO_VER',
  existencias: 'INVENTARIO_VER',
  movimientos: 'INVENTARIO_VER',
  'conteo-fisico': 'INVENTARIO_GESTIONAR',
  categorias: 'PRODUCTO_VER',
  marcas: 'PRODUCTO_VER',
  almacenes: 'INVENTARIO_VER',
  'ordenes-compra': 'COMPRA_GESTIONAR',
  'notas-recepcion': 'COMPRA_GESTIONAR',
  proveedores: 'PROVEEDOR_GESTIONAR',
  'gastos-pagos-proveedor': 'COMPRA_GESTIONAR',
  'turnos-caja': 'CAJA_OPERAR',
  'movimientos-caja': 'CAJA_GESTIONAR',
  'caja-chica': 'CAJA_GESTIONAR',
  usuarios: 'USUARIO_GESTIONAR',
  roles: 'ROL_GESTIONAR',
  ofertas: 'CONFIGURACION_VER',
  ncf: 'CONFIGURACION_VER',
  'cajas-registradoras': 'CAJA_GESTIONAR',
};

const menuSections: MenuSection[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { id: 'pos', label: 'Punto de Venta', icon: Monitor, requiredPermission: 'VENTA_CREAR' },
      { id: 'ventas-historial', label: 'Historial de Ventas', icon: FileText, requiredPermission: 'VENTA_VER' },
      { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw, requiredPermission: 'DEVOLUCION_CREAR' },
      { id: 'notas-credito', label: 'Notas de Crédito', icon: Receipt, requiredPermission: 'DEVOLUCION_CREAR' },
    ]
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    items: [
      { id: 'clientes', label: 'Gestión de Clientes', icon: UserCircle, requiredPermission: 'CLIENTE_GESTIONAR' },
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Package,
    items: [
      { id: 'productos', label: 'Productos', icon: Package, requiredPermission: 'PRODUCTO_VER' },
      { id: 'existencias', label: 'Existencias', icon: BarChart3, requiredPermission: 'INVENTARIO_VER' },
      { id: 'movimientos', label: 'Movimientos', icon: TrendingUp, requiredPermission: 'INVENTARIO_VER' },
      { id: 'conteo-fisico', label: 'Conteo Físico', icon: ClipboardCheck, requiredPermission: 'INVENTARIO_GESTIONAR' },
      { id: 'categorias', label: 'Categorías', icon: Tag, requiredPermission: 'PRODUCTO_VER' },
      { id: 'marcas', label: 'Marcas', icon: Tag, requiredPermission: 'PRODUCTO_VER' },
      { id: 'almacenes', label: 'Almacenes', icon: Archive, requiredPermission: 'INVENTARIO_VER' },
    ]
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: Truck,
    items: [
      { id: 'ordenes-compra', label: 'Órdenes de Compra', icon: ClipboardList, requiredPermission: 'COMPRA_GESTIONAR' },
      { id: 'notas-recepcion', label: 'Notas de Recepción', icon: FileText, requiredPermission: 'COMPRA_GESTIONAR' },
      { id: 'proveedores', label: 'Proveedores', icon: Store, requiredPermission: 'PROVEEDOR_GESTIONAR' },
    ]
  },
  {
    id: 'gastos',
    label: 'Gastos',
    icon: Wallet,
    items: [
      { id: 'gastos-pagos-proveedor', label: 'Pagos a Proveedores', icon: Receipt, requiredPermission: 'COMPRA_GESTIONAR' },
    ]
  },
  {
    id: 'caja',
    label: 'Caja',
    icon: CreditCard,
    items: [
      { id: 'turnos-caja', label: 'Turnos de Caja', icon: CreditCard, requiredPermission: 'CAJA_OPERAR' },
      { id: 'movimientos-caja', label: 'Movimientos', icon: TrendingUp, requiredPermission: 'CAJA_GESTIONAR' },
      { id: 'caja-chica', label: 'Caja Chica', icon: Wallet, requiredPermission: 'CAJA_GESTIONAR' },
    ]
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { id: 'usuarios', label: 'Usuarios', icon: Users, requiredPermission: 'USUARIO_GESTIONAR' },
      { id: 'roles', label: 'Roles', icon: UserCircle, requiredPermission: 'ROL_GESTIONAR' },
      { id: 'ofertas', label: 'Ofertas', icon: Tag, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'ncf', label: 'Secuencias NCF', icon: Receipt, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'cajas-registradoras', label: 'Cajas Registradoras', icon: Monitor, requiredPermission: 'CAJA_GESTIONAR' },
    ]
  },
];

export default function Sidebar({ activeView, onViewChange, username, userRoles = [], userPermisos = [], onLogout }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['ventas']);

  // Filter sections and items based on user permissions
  const visibleSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        // If no permission required, always show
        if (!item.requiredPermission) return true;
        // Show if user has the required permission
        return userPermisos.includes(item.requiredPermission);
      }),
    }))
    // Hide sections with no visible items
    .filter(section => section.items.length > 0);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-sidebar-foreground">ERP Sistema</h1>
        <p className="text-sm text-sidebar-foreground/60 mt-1">Tienda por Departamento</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
          </li>

          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.id);
            const hasActiveItem = section.items.some(item => item.id === activeView);

            return (
              <li key={section.id} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    hasActiveItem && !isExpanded
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SectionIcon size={20} />
                    <span>{section.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <ul className="ml-4 space-y-1">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activeView === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => onViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                            }`}
                          >
                            <ItemIcon size={18} />
                            <span>{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-semibold shrink-0">
            {username
              ? username.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{username || 'Usuario'}</p>
            <p className="text-xs text-sidebar-foreground/60">Sesión activa</p>
          </div>
          {onLogout && (
            <button
              id="sidebar-logout-btn"
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
