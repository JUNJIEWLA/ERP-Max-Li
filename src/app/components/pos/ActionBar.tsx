interface ActionBarProps {
  onCancel: () => void;
  onHold: () => void;
  onHoldList: () => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export default function ActionBar({ onCancel, onHold, onHoldList, onCheckout, disabled = false }: ActionBarProps) {
  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Cancelar (F4)
        </button>
        <button
          onClick={onHold}
          disabled={disabled}
          className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          En espera (F5)
        </button>
        <button
          onClick={onHoldList}
          className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          Lista espera (F6)
        </button>
        <button
          onClick={onCheckout}
          disabled={disabled}
          className="flex-[2] px-6 py-3 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Cobrar (ESC)
        </button>
      </div>
    </div>
  );
}
