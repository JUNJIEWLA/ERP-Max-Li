import { useState, useEffect, useCallback } from 'react';
import { Bell, Search } from 'lucide-react';
import { alertasCostoApi, alertasRetrasoOcApi } from '../../imports/api';
import Buzon from './Buzon';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [alertCount, setAlertCount] = useState(0);
  const [showBuzon, setShowBuzon] = useState(false);

  const fetchAlertsCount = useCallback(async () => {
    try {
      // Promise.all para evitar parpadeo: actualizamos el badge solo cuando ambas resuelven
      const [costosRes, retrasoRes] = await Promise.all([
        alertasCostoApi.contarPendientes(),
        alertasRetrasoOcApi.contarPendientes(),
      ]);
      setAlertCount((costosRes.count ?? 0) + (retrasoRes.count ?? 0));
    } catch (e) {
      console.error('Error fetching alerts count', e);
    }
  }, []);

  useEffect(() => {
    fetchAlertsCount();
    const interval = setInterval(fetchAlertsCount, 30000);
    return () => clearInterval(interval);
  }, [fetchAlertsCount]);

  return (
    <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between relative z-40">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-80 pl-10 pr-4 py-2 bg-muted/30 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          onClick={() => setShowBuzon(true)}
          className="relative p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
          title="Buzón de Alertas"
        >
          <Bell size={20} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm border-2 border-background">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>
      </div>

      {showBuzon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl h-[80vh] flex flex-col">
            <Buzon
              onClose={() => setShowBuzon(false)}
              onUpdateCount={fetchAlertsCount}
            />
          </div>
        </div>
      )}
    </header>
  );
}
