import { useEffect, useState } from 'react';

interface POSHeaderProps {
  ncf: string;
  tipoDocumento: string;
  cajero: string;
  caja: string;
  turno: string;
  onChangeTipoDocumento: () => void;
}

export default function POSHeader({ ncf, tipoDocumento, cajero, caja, turno, onChangeTipoDocumento }: POSHeaderProps) {
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
    <div className="px-6 py-3 border-b border-border bg-background">
      <div className="flex items-center gap-4 mb-2">
        <h3>Punto de venta</h3>
        <span className="text-blue-600 font-mono">{ncf}</span>
        <button
          onClick={onChangeTipoDocumento}
          className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
          title="Presione F7 para cambiar"
        >
          {tipoDocumento}
        </button>
      </div>
      <div className="text-sm text-muted-foreground flex items-center gap-6">
        <span>{formatDate(currentTime)}</span>
        <span>{formatTime(currentTime)}</span>
        <span>Caja: {caja}</span>
        <span>Cajero: {cajero}</span>
        <span>Turno: {turno}</span>
      </div>
    </div>
  );
}
