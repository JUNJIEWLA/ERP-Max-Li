import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, UserCircle, FileText, Percent, Loader2, UserX, Users } from 'lucide-react';
import { clientesApi, ClienteResumen } from '../../../imports/api';

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
  const [allClientes, setAllClientes] = useState<ClienteResumen[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cargar todos los clientes al abrir el modal
  useEffect(() => {
    searchRef.current?.focus();
    clientesApi.listarParaPOS()
      .then((data) => { setAllClientes(data); })
      .catch(() => { setError('No se pudo cargar la lista de clientes.'); })
      .finally(() => setLoading(false));
  }, []);

  // Filtrado local instantáneo por nombre O RNC
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allClientes;
    return allClientes.filter((c) => {
      const nombre = c.nombreCompleto.toLowerCase();
      const rnc = (c.rncCedula ?? '').toLowerCase().replace(/[-\s]/g, '');
      const qClean = q.replace(/[-\s]/g, '');
      return nombre.includes(q) || rnc.includes(qClean);
    });
  }, [query, allClientes]);

  // Resetear índice seleccionado al cambiar el filtro
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-scroll del elemento seleccionado
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = (cliente: ClienteResumen) => {
    onSelect(cliente);
    onClose();
  };

  const handleClearCliente = () => {
    onSelect(null);
    onClose();
  };

  // Manejo de flechas + Enter + Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-blue-500" />
            <div>
              <h2 className="text-base font-semibold leading-none">Seleccionar Cliente</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? 'Cargando clientes...' : `${allClientes.length} clientes activos · Navega con ↑ ↓`}
              </p>
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

        {/* Búsqueda */}
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filtrar por nombre o RNC/Cédula… (↑ ↓ Navegar)"
              className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {query && !loading && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">
              {filtered.length === 0
                ? 'Ningún cliente coincide'
                : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Lista de Clientes */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">Cargando clientes...</p>
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-8 text-sm text-destructive text-center">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <UserCircle size={28} className="mx-auto mb-2 opacity-30" />
              No se encontraron clientes con ese criterio
            </div>
          )}

          {!loading && !error && filtered.map((c, index) => {
            const isHighlighted = index === selectedIndex;
            return (
              <button
                key={c.idCliente}
                ref={(el) => { itemRefs.current[index] = el; }}
                id={`pos-cliente-${c.idCliente}`}
                onClick={() => handleSelect(c)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-all text-left ${
                  isHighlighted
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-600 font-semibold shadow-xs'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isHighlighted ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {c.nombreCompleto.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isHighlighted ? 'text-blue-900 dark:text-blue-100 font-bold' : 'font-medium'}`}>
                    {c.nombreCompleto}
                  </p>
                  {c.rncCedula && (
                    <p className="text-xs text-muted-foreground font-mono">{c.rncCedula}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${NCF_COLOR[c.tipoNcfPreferido] ?? 'text-muted-foreground bg-muted border-border'}`}>
                    <FileText size={10} />
                    {c.tipoNcfPreferido}
                  </span>
                  {c.descuentoPredeterminado > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                      <Percent size={10} />
                      {c.descuentoPredeterminado}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer con atajos de teclado */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <button
            id="pos-limpiar-cliente"
            onClick={handleClearCliente}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <UserX size={13} />
            Consumidor Final
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">↑ ↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">Enter</kbd> Seleccionar</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">Esc</kbd> Salir</span>
          </div>
        </div>
      </div>
    </div>
  );
}
