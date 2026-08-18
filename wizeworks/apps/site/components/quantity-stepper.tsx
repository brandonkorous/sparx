'use client';

// Quantity stepper. Decrementing below 1 calls onRemove (so "−" at qty 1
// removes the line). Used in the mini-cart and the full cart page.

export interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  onRemove?: () => void;
  small?: boolean;
  max?: number;
}

export function QuantityStepper({
  value,
  onChange,
  onRemove,
  small,
  max = 999,
}: QuantityStepperProps) {
  function dec() {
    if (value <= 1) onRemove?.();
    else onChange(value - 1);
  }
  function inc() {
    onChange(Math.min(max, value + 1));
  }

  return (
    <div
      className="rounded-field border-base-300 inline-flex items-center overflow-hidden border"
      style={small ? { transform: 'scale(0.9)', transformOrigin: 'left' } : undefined}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className="bg-base-100 text-base-content hover:bg-base-200 h-11 w-10 cursor-pointer border-0 text-lg transition-colors"
        onClick={dec}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        aria-label="Quantity"
        className="border-base-300 bg-base-100 text-base-content h-11 w-11 [appearance:textfield] border-x text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(max, Math.floor(n)));
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className="bg-base-100 text-base-content hover:bg-base-200 h-11 w-10 cursor-pointer border-0 text-lg transition-colors"
        onClick={inc}
      >
        +
      </button>
    </div>
  );
}
