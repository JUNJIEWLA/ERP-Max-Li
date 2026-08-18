import { useState, useEffect, useRef } from 'react';
import { LogOut, PanelLeftClose, PanelLeft, Search, X } from 'lucide-react';
import {
  ShoppingCart,
  Package,
  Users,
  Store,
  CreditCard,
  Settings,
  Truck,
  BarChart3,
  Tag,
  Monitor,
  FileText,
  Wallet,
  ChevronDown,
  ChevronRight,
  UserCircle,
  Undo2,
  ClipboardList,
  ClipboardCheck,
  Archive,
  TrendingUp,
  Receipt,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  username?: string;
  userRoles?: string[];
  userPermisos?: string[];
  onLogout?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
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
 * Solo contiene vistas realmente implementadas y navegables.
 */
export const PERMISSION_MAP: Record<string, string> = {
  pos: 'VENTA_CREAR',
  'ventas-historial': 'VENTA_VER',
  devoluciones: 'VENTA_VER',
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
  'caja-chica': 'CAJA_GESTIONAR',
  usuarios: 'USUARIO_GESTIONAR',
  roles: 'ROL_GESTIONAR',
  ofertas: 'CONFIGURACION_VER',
  ncf: 'CONFIGURACION_VER',
  cupones: 'CONFIGURACION_VER',
  'cajas-registradoras': 'CAJA_GESTIONAR',
  'configuracion-empresa': 'CONFIGURACION_VER',
};

const menuSections: MenuSection[] = [
  {
    id: 'dashboard-reportes',
    label: 'Dashboard & Reportes',
    icon: BarChart3,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
      { id: 'reportes', label: 'Reportes', icon: FileText },
    ]
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { id: 'pos', label: 'Punto de Venta', icon: Monitor, requiredPermission: 'VENTA_CREAR' },
      { id: 'ventas-historial', label: 'Historial de Ventas', icon: Receipt, requiredPermission: 'VENTA_VER' },
      { id: 'devoluciones', label: 'Devoluciones y Notas de Crédito', icon: Undo2, requiredPermission: 'VENTA_VER' },
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
      { id: 'configuracion-empresa', label: 'Datos de la Empresa', icon: Building2, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'ofertas', label: 'Ofertas', icon: Tag, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'ncf', label: 'Secuencias NCF', icon: Receipt, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'cupones', label: 'Cupones', icon: Tag, requiredPermission: 'CONFIGURACION_VER' },
      { id: 'cajas-registradoras', label: 'Cajas Registradoras', icon: Monitor, requiredPermission: 'CAJA_GESTIONAR' },
    ]
  },
];

/**
 * Primera vista real que el usuario puede abrir, siguiendo el orden del menú.
 * Devuelve null si no tiene ningún módulo asignado. Sustituye al antiguo
 * dashboard como vista inicial y como destino al perder un permiso.
 */
export function primeraVistaPermitida(userPermisos: string[]): string | null {
  for (const section of menuSections) {
    for (const item of section.items) {
      if (!item.requiredPermission || userPermisos.includes(item.requiredPermission)) {
        return item.id;
      }
    }
  }
  return null;
}

/** MAX LI mountain logo as inline SVG */
function MaxLiLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sidebar-gold-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFEB68"/>
          <stop offset="60%" stopColor="#F5C832"/>
          <stop offset="100%" stopColor="#E2B11B"/>
        </linearGradient>
        <linearGradient id="sidebar-gold-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF38B"/>
          <stop offset="100%" stopColor="#EDBC26"/>
        </linearGradient>
      </defs>
      {/* Left Mountain Peak */}
      <path d="M 90,310 L 205,105 L 245,285 L 210,285 L 188,200 L 125,310 Z" fill="url(#sidebar-gold-grad-1)" />
      {/* Inner Left Chevron Fold */}
      <path d="M 160,250 L 205,150 L 230,260 L 210,260 L 195,200 L 175,250 Z" fill="url(#sidebar-gold-grad-2)" />
      {/* Right Mountain Peak (Taller) */}
      <path d="M 298,35 L 410,310 L 350,310 L 298,165 L 255,310 L 215,310 L 285,115 Z" fill="url(#sidebar-gold-grad-1)" />
      {/* Inner Right Chevron Fold */}
      <path d="M 285,115 L 325,210 L 275,310 L 255,310 L 295,200 L 275,150 Z" fill="url(#sidebar-gold-grad-2)" />
    </svg>
  );
}

export default function Sidebar({ activeView, onViewChange, username, userRoles = [], userPermisos = [], onLogout, collapsed, onToggleCollapse }: SidebarProps) {
  // La vista inicial siempre pertenece a alguna sección: se abre esa para que el
  // usuario vea dónde está.
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    const seccionInicial = menuSections.find(s => s.items.some(i => i.id === activeView));
    return [seccionInicial?.id ?? 'ventas'];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when search is shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

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

  // Apply search filter on top of permissions
  const filteredSections = searchQuery.trim()
    ? visibleSections
        .map(section => ({
          ...section,
          items: section.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            section.label.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(section => section.items.length > 0)
    : visibleSections;

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Tooltip para items cuando está colapsado
  const [tooltipInfo, setTooltipInfo] = useState<{ label: string; top: number } | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleMouseEnterItem = (label: string, e: React.MouseEvent) => {
    if (!collapsed) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipInfo({ label, top: rect.top + rect.height / 2 });
  };

  const handleMouseLeaveItem = () => {
    setTooltipInfo(null);
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar-pro ${collapsed ? 'sidebar-pro--collapsed' : ''}`}
      >
        {/* ─── Brand Header ─── */}
        <div className="sidebar-pro__brand">
          <div className="sidebar-pro__brand-logo" onClick={onToggleCollapse} title={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
            <MaxLiLogo size={collapsed ? 30 : 36} />
          </div>
          {!collapsed && (
            <div className="sidebar-pro__brand-text">
              <h1 className="sidebar-pro__brand-title">MAX ERP</h1>
              <p className="sidebar-pro__brand-subtitle">Sistema de Gestión</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="sidebar-pro__collapse-btn"
              title="Colapsar menú"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        {/* ─── Search Bar ─── */}
        {!collapsed && (
          <div className="sidebar-pro__search-wrap">
            {showSearch ? (
              <div className="sidebar-pro__search-bar">
                <Search size={14} className="sidebar-pro__search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar módulo…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="sidebar-pro__search-input"
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="sidebar-pro__search-close"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSearch(true)} className="sidebar-pro__search-trigger">
                <Search size={14} />
                <span>Buscar…</span>
                <kbd className="sidebar-pro__search-kbd">Ctrl+K</kbd>
              </button>
            )}
          </div>
        )}

        {/* ─── Navigation ─── */}
        <nav className="sidebar-pro__nav">
          <ul className="sidebar-pro__sections">
            {filteredSections.map((section) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.includes(section.id) || searchQuery.trim() !== '';
              const hasActiveItem = section.items.some(item => item.id === activeView);

              return (
                <li key={section.id} className="sidebar-pro__section">
                  <button
                    onClick={() => {
                      if (collapsed) {
                        // En modo colapsado: si la sección tiene un solo item, navegar directamente
                        if (section.items.length === 1) {
                          onViewChange(section.items[0].id);
                        } else {
                          onToggleCollapse();
                          setExpandedSections(prev =>
                            prev.includes(section.id) ? prev : [...prev, section.id]
                          );
                        }
                      } else {
                        toggleSection(section.id);
                      }
                    }}
                    onMouseEnter={(e) => handleMouseEnterItem(section.label, e)}
                    onMouseLeave={handleMouseLeaveItem}
                    className={`sidebar-pro__section-btn ${
                      hasActiveItem
                        ? 'sidebar-pro__section-btn--active'
                        : ''
                    }`}
                    title={collapsed ? section.label : undefined}
                  >
                    <div className="sidebar-pro__section-left">
                      <SectionIcon size={collapsed ? 20 : 18} />
                      {!collapsed && <span>{section.label}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        size={14}
                        className={`sidebar-pro__chevron ${isExpanded ? 'sidebar-pro__chevron--open' : ''}`}
                      />
                    )}
                  </button>

                  {/* Sub-items */}
                  {!collapsed && isExpanded && (
                    <ul className="sidebar-pro__items">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = activeView === item.id;

                        return (
                          <li key={item.id}>
                            <button
                              onClick={() => onViewChange(item.id)}
                              className={`sidebar-pro__item-btn ${
                                isActive ? 'sidebar-pro__item-btn--active' : ''
                              }`}
                            >
                              <ItemIcon size={16} />
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

        {/* ─── User Footer ─── */}
        <div className="sidebar-pro__footer">
          <div className={`sidebar-pro__user ${collapsed ? 'sidebar-pro__user--collapsed' : ''}`}>
            <div className="sidebar-pro__user-avatar">
              {username
                ? username.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : 'U'}
            </div>
            {!collapsed && (
              <div className="sidebar-pro__user-info">
                <p className="sidebar-pro__user-name">{username || 'Usuario'}</p>
                <p className="sidebar-pro__user-status">Sesión activa</p>
              </div>
            )}
            {onLogout && (
              <button
                id="sidebar-logout-btn"
                onClick={onLogout}
                onMouseEnter={(e) => handleMouseEnterItem('Cerrar sesión', e)}
                onMouseLeave={handleMouseLeaveItem}
                title="Cerrar sesión"
                className="sidebar-pro__logout-btn"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Tooltip flotante para modo colapsado */}
      {collapsed && tooltipInfo && (
        <div
          className="sidebar-pro__tooltip"
          style={{ top: tooltipInfo.top }}
        >
          {tooltipInfo.label}
        </div>
      )}
    </>
  );
}
