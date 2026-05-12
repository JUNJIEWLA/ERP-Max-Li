import { useState } from 'react';
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
  Archive,
  TrendingUp,
  Receipt
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
}

interface MenuSection {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { id: 'pos', label: 'Punto de Venta', icon: Monitor },
      { id: 'ventas-historial', label: 'Historial de Ventas', icon: FileText },
      { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
      { id: 'notas-credito', label: 'Notas de Crédito', icon: Receipt },
    ]
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    items: [
      { id: 'clientes', label: 'Gestión de Clientes', icon: UserCircle },
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Package,
    items: [
      { id: 'productos', label: 'Productos', icon: Package },
      { id: 'existencias', label: 'Existencias', icon: BarChart3 },
      { id: 'movimientos', label: 'Movimientos', icon: TrendingUp },
      { id: 'categorias', label: 'Categorías', icon: Tag },
      { id: 'marcas', label: 'Marcas', icon: Tag },
      { id: 'almacenes', label: 'Almacenes', icon: Archive },
    ]
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: Truck,
    items: [
      { id: 'ordenes-compra', label: 'Órdenes de Compra', icon: ClipboardList },
      { id: 'notas-recepcion', label: 'Notas de Recepción', icon: FileText },
      { id: 'proveedores', label: 'Proveedores', icon: Store },
      { id: 'pagos-proveedor', label: 'Pagos a Proveedores', icon: Wallet },
    ]
  },
  {
    id: 'caja',
    label: 'Caja',
    icon: CreditCard,
    items: [
      { id: 'turnos-caja', label: 'Turnos de Caja', icon: CreditCard },
      { id: 'movimientos-caja', label: 'Movimientos', icon: TrendingUp },
      { id: 'caja-chica', label: 'Caja Chica', icon: Wallet },
    ]
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { id: 'usuarios', label: 'Usuarios', icon: Users },
      { id: 'roles', label: 'Roles', icon: UserCircle },
      { id: 'ofertas', label: 'Ofertas', icon: Tag },
      { id: 'ncf', label: 'Secuencias NCF', icon: Receipt },
      { id: 'cajas-registradoras', label: 'Cajas Registradoras', icon: Monitor },
    ]
  },
];

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['ventas']);

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

          {menuSections.map((section) => {
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
          <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            AD
          </div>
          <div className="flex-1">
            <p className="text-sm text-sidebar-foreground">Admin User</p>
            <p className="text-xs text-sidebar-foreground/60">admin@tienda.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
