import { useState, useEffect, useRef } from 'react';
import { X, Search, UserCircle, FileText, Percent, Loader2, UserX } from 'lucide-react';
import { clientesApi, ClienteResumen } from '../../../imports/api';

const NCF_LABEL: Record<string, string> = {
  B01: 'Crédito Fiscal',
  B02: 'Consumidor Final',
  B14: 'Régimen Especial',
  B15: 'Gubernamental',
};

const NCF_COLOR: Record<string, string> = {
  B01: 'text-blue-600 bg-blue-50 border-blue-200',
  B02: 'text-green-600 bg-green-50 border-green-200',
  B14: 'text-purple-600 bg-purple-50 border-purple-200',
  B15: 'text-orange-600 bg-orange-50 border-orange-200',
};

interface ClienteSelectorModalProps {
  onSelect: (cliente: ClienteResumen | null) => void;
  onClose: () => void;
}

export default function ClienteSelectorModal({ onSelect, onClose }: ClienteSelectorModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClienteResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autoenfoque al abrir
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Búsqueda con debounce de 250ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setError('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await clientesApi.buscarParaPOS(query.trim());
        setResults(data);
      } catch (err: any) {
        setError('Error al buscar clientes.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = (cliente: ClienteResumen) => {
    onSelect(cliente);
    onClose();
  };

  const handleClearCliente = () => {
    onSelect(null); // null = volver a Consumidor Final genérico
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <UserCircle size={18} className="text-blue-500" />
            <div>
              <h2 className="text-base font-semibold leading-none">Seleccionar Cliente</h2>
              <p className="text-xs text-muted-foreground mt-0.5">F3 · Atajo de teclado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o RNC/Cédula…"
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
            {loading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">Escribe al menos 2 caracteres…</p>
          )}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 text-sm text-destructive text-center">{error}</div>
          )}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <UserCircle size={28} className="mx-auto mb-2 opacity-30" />
              No se encontraron clientes con ese nombre
            </div>
          )}

          {results.map((c) => (
            <button
              key={c.idCliente}
              id={`pos-cliente-${c.idCliente}`}
              onClick={() => handleSelect(c)}
              className="w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors text-left"
            >
              {/* Avatar inicial */}
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0 mt-0.5">
                {c.nombreCompleto.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.nombreCompleto}</p>
                {c.rncCedula && (
                  <p className="text-xs text-muted-foreground font-mono">{c.rncCedula}</p>
                )}
              </div>

              {/* Badges NCF + Descuento */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${NCF_COLOR[c.tipoNcfPreferido] ?? 'text-muted-foreground bg-muted border-border'}`}>
                  <FileText size={10} />
                  {c.tipoNcfPreferido}
                </span>
                <span className="text-xs text-muted-foreground">
                  {NCF_LABEL[c.tipoNcfPreferido] ?? c.tipoNcfPreferido}
                </span>
                {c.descuentoPredeterminado > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                    <Percent size={10} />
                    {c.descuentoPredeterminado}% desc.
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer — botón limpiar cliente */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <button
            id="pos-limpiar-cliente"
            onClick={handleClearCliente}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <UserX size={13} />
            Limpiar (volver a Consumidor Final)
          </button>
          <span className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">Esc</kbd>
            {' '}cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
