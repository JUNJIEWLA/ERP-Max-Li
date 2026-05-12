import { useState, useEffect, useRef } from 'react';

interface QtyInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: boolean;
}

export default function QtyInput({ value, onChange, min = 0, max = 999999, decimals = false }: QtyInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (decimals) {
      if (/^\d*\.?\d*$/.test(newValue)) {
        setLocalValue(newValue);
      }
    } else {
      if (/^\d*$/.test(newValue)) {
        setLocalValue(newValue);
      }
    }
  };

  const handleBlur = () => {
    const numValue = parseFloat(localValue) || 0;
    const clampedValue = Math.max(min, Math.min(max, numValue));
    setLocalValue(clampedValue.toString());
    onChange(clampedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-16 text-center px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
    />
  );
}
