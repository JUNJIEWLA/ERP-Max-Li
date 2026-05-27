interface ActionBarProps {
  onCancel: () => void;
  onHold: () => void;
  onHoldList: () => void;
  onCheckout: () => void;
  disabled?: boolean;
  holdCount?: number;
}

export default function ActionBar({ onCancel, onHold, onHoldList, onCheckout, disabled = false, holdCount = 0 }: ActionBarProps) {
  return (
    <div className="border-t border-border bg-background px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Cancelar (F4)
        </button>
        <button
          onClick={onHold}
          disabled={disabled}
          className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          En espera (F5)
        </button>
        <button
          onClick={onHoldList}
          className="flex-1 relative px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm hover:opacity-90 transition-opacity"
        >
          Lista espera (F6)
          {holdCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white rounded-full text-xs font-bold flex items-center justify-center">
              {holdCount > 9 ? '9+' : holdCount}
            </span>
          )}
        </button>
        <button
          onClick={onCheckout}
          disabled={disabled}
          className="flex-[2] px-4 py-2 bg-blue-600 text-white rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Cobrar (ESC)
        </button>
      </div>
    </div>
  );
}
