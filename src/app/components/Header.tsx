import { Bell, Search, LogOut, User } from 'lucide-react';

interface HeaderProps {
  title: string;
  username?: string;
  onLogout?: () => void;
}

export default function Header({ title, username, onLogout }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between">
      <h2>{title}</h2>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-80 pl-10 pr-4 py-2 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button className="relative p-2 hover:bg-accent rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </button>

        {username && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User size={16} />
              <span className="font-medium text-foreground">{username}</span>
            </div>
            <button
              id="header-logout-btn"
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
