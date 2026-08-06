import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Barcode } from 'lucide-react';
import { productosApi, Producto } from '../../../imports/api';

interface SearchBarProps {
  onProductSelect: (product: Producto) => void;
}

export default function SearchBar({ onProductSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Producto[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (product: Producto) => {
    onProductSelect(product);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(0);
    // Devolver foco al campo de búsqueda para el siguiente escaneo
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await productosApi.buscarParaPOS(q);
        const qLower = q.toLowerCase();

        // Buscar coincidencias exactas por código de barras o SKU
        const exactMatches = results.filter((p) =>
          (p.codigoBarras && p.codigoBarras.toLowerCase() === qLower) ||
          (p.sku && p.sku.toLowerCase() === qLower)
        );

        // REGLA CLAVE: Si hay EXACTAMENTE 1 coincidencia exacta por código de barras / SKU -> AUTO-AGREGAR!
        if (exactMatches.length === 1) {
          handleSelect(exactMatches[0]);
          return;
        }

        // Si el código de barras se repite (varios productos con el mismo barcode/SKU)
        // o si es una búsqueda de texto normal por nombre -> Mostrar opciones en dropdown
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Error buscando productos POS:', err);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si se presiona Enter y hay sugerencias, agregar la seleccionada
      if (showDropdown && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      } else if (suggestions.length === 1) {
        handleSelect(suggestions[0]);
      }
      return;
    }

    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanear código de barras o buscar por nombre / SKU…"
          className="w-full pl-10 pr-9 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background shadow-xs font-medium"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-2xl shadow-2xl max-h-80 overflow-y-auto z-50 divide-y divide-border/40 animate-in fade-in zoom-in-95 duration-100"
        >
          {suggestions.map((product, index) => {
            const isBarcodeMatch = query.trim() && product.codigoBarras?.toLowerCase() === query.trim().toLowerCase();
            return (
              <div
                key={product.idProducto}
                onClick={() => handleSelect(product)}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  index === selectedIndex
                    ? 'bg-blue-50/90 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border-l-4 border-l-blue-600'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{product.nombre}</p>
                    {isBarcodeMatch && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                        <Barcode size={10} />
                        Cód. coincidente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px] font-medium text-foreground">
                      {product.sku}
                    </span>
                    {product.codigoBarras && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Barcode size={12} className="text-muted-foreground shrink-0" />
                        {product.codigoBarras}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Stock: {product.stockTotal ?? 0}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                    RD$ {product.precioVenta.toFixed(2)}
                  </p>
                  {product.categoriaNombre && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {product.categoriaNombre}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
