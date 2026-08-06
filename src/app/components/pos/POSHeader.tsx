import { useEffect, useState } from 'react';
import { UserCircle, CheckCircle2 } from 'lucide-react';

interface POSHeaderProps {
  ncf: string;
  tipoDocumento: string;
  cajero: string;
  caja: string;
  turno: string;
  clienteNombre: string;
  tieneCliente: boolean;
  onChangeTipoDocumento: () => void;
}

export default function POSHeader({ ncf, tipoDocumento, cajero, caja, turno, clienteNombre, tieneCliente, onChangeTipoDocumento }: POSHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-background">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-base">Punto de venta</h3>
        <span className="text-blue-600 font-mono text-sm">{ncf}</span>
        <button
          onClick={onChangeTipoDocumento}
          className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 transition-colors"
          title="F7: ciclar comprobante | F10: selector completo"
        >
          {tipoDocumento}
        </button>
        <span className="text-xs text-muted-foreground select-none">
          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">F10</kbd>
          {' '}
          <span className="text-muted-foreground">Cambiar NCF</span>
        </span>

        {/* Cliente activo en el header */}
        <div className="ml-auto flex items-center gap-1.5">
          {tieneCliente
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <UserCircle size={13} className="text-muted-foreground" />}
          <span className={`text-xs font-semibold ${tieneCliente ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {clienteNombre}
          </span>
          {tieneCliente && (
            <span className="text-xs text-muted-foreground">(F3 para cambiar)</span>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-4">
        <span>{formatDate(currentTime)}</span>
        <span>{formatTime(currentTime)}</span>
        <span>Caja: {caja}</span>
        <span>Cajero: {cajero}</span>
        <span>Turno: {turno}</span>
      </div>
    </div>
  );
}
