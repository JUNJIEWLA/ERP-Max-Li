import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface ProductSuggestion {
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
  unidad: string;
}

interface SearchBarProps {
  onProductSelect: (product: ProductSuggestion) => void;
}

const mockProducts: ProductSuggestion[] = [
  { codigo: 'PROD-001', nombre: 'GALLETAS 25 GR CHOCOLATE', precio: 18.00, stock: 150, unidad: 'PZ' },
  { codigo: 'PROD-002', nombre: 'ARROZ LARGO 1KG', precio: 27.00, stock: 200, unidad: 'PZ' },
  { codigo: 'PROD-003', nombre: 'ACEITE VEGETAL 1L', precio: 45.00, stock: 80, unidad: 'PZ' },
  { codigo: 'PROD-004', nombre: 'LECHE ENTERA 1L', precio: 35.00, stock: 120, unidad: 'PZ' },
  { codigo: 'PROD-005', nombre: 'PAN TAJADO INTEGRAL', precio: 22.00, stock: 95, unidad: 'PZ' },
  { codigo: 'PROD-006', nombre: 'AZÚCAR BLANCA 2KG', precio: 38.00, stock: 180, unidad: 'PZ' },
  { codigo: 'PROD-007', nombre: 'CAFÉ MOLIDO 500G', precio: 65.00, stock: 55, unidad: 'PZ' },
  { codigo: 'PROD-008', nombre: 'PASTA ESPAGUETI 500G', precio: 15.00, stock: 220, unidad: 'PZ' },
];

export default function SearchBar({ onProductSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const filtered = mockProducts.filter(
        (p) =>
          p.codigo.toLowerCase().includes(query.toLowerCase()) ||
          p.nombre.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [query]);

  const handleSelect = (product: ProductSuggestion) => {
    onProductSelect(product);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cód. de barras o nombre..."
          className="w-full pl-12 pr-4 py-3 border border-border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-80 overflow-auto z-50"
        >
          {suggestions.map((product, index) => (
            <div
              key={product.codigo}
              onClick={() => handleSelect(product)}
              className={`px-4 py-3 cursor-pointer border-b border-border last:border-b-0 ${
                index === selectedIndex ? 'bg-blue-50' : 'hover:bg-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{product.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.codigo} • Stock: {product.stock} {product.unidad}
                  </p>
                </div>
                <p className="text-lg ml-4">${product.precio.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
