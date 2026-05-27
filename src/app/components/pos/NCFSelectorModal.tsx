import { X, FileText, Check } from 'lucide-react';

export interface TipoNCF {
  codigo: string;
  nombre: string;
}

interface NCFSelectorModalProps {
  tiposNCF: TipoNCF[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function NCFSelectorModal({ tiposNCF, currentIndex, onSelect, onClose }: NCFSelectorModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <FileText size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold">Tipo de Comprobante (NCF)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Cerrar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Lista de tipos */}
        <div className="p-3 space-y-1.5">
          {tiposNCF.map((tipo, index) => (
            <button
              key={tipo.codigo}
              onClick={() => { onSelect(index); onClose(); }}
              className={[
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                index === currentIndex
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-muted',
              ].join(' ')}
            >
              {/* Código */}
              <span className={[
                'font-mono text-xs px-2 py-0.5 rounded font-bold',
                index === currentIndex
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-foreground',
              ].join(' ')}>
                {tipo.codigo}
              </span>

              {/* Nombre */}
              <span className="flex-1 text-sm font-medium">{tipo.nombre}</span>

              {/* Indicador activo */}
              {index === currentIndex && (
                <Check size={16} className="text-white flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        <div className="px-5 pb-4 pt-1 text-xs text-muted-foreground text-center">
          Atajo: <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-foreground font-mono">F10</kbd> para abrir &nbsp;|&nbsp;
          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-foreground font-mono">F7</kbd> para ciclar
        </div>
      </div>
    </div>
  );
}
