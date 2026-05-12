import { Home, ShoppingCart, Package, CreditCard, FileText, DollarSign } from 'lucide-react';

interface POSSidebarProps {
  cajeroNombre: string;
  cajaId: string;
  activeMenu: string;
  onMenuChange: (menu: string) => void;
}

const menuItems = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { id: 'articulos', label: 'Artículos', icon: Package },
];

const adminMenuItems = [
  { id: 'caja', label: 'Caja', icon: CreditCard },
  { id: 'operaciones', label: 'Operaciones', icon: FileText },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
];

export default function POSSidebar({ cajeroNombre, cajaId, activeMenu, onMenuChange }: POSSidebarProps) {
  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h2 className="text-primary">POS Pro</h2>
      </div>

      <nav className="flex-1 p-4">
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-2 px-3">MENÚ</p>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onMenuChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2 px-3">ADMINISTRACIÓN</p>
          <ul className="space-y-1">
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onMenuChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <div>
          <p className="text-sm">{cajeroNombre}</p>
          <p className="text-xs text-muted-foreground mt-1">{cajaId} • Admin</p>
        </div>
      </div>
    </aside>
  );
}
