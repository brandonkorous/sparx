'use client';

// Quantity stepper. Decrementing below the smallest amount calls onRemove (so
// "−" at qty 1 removes the line). Used in the mini-cart and the full cart page.
//
// A trade account's line can carry a case pack and a minimum (sparx persona
// issue 086): `step` makes + and - move in whole cases, landing on a whole case
// from an amount that is not one, and `min` is where "−" stops being a change.

export interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  onRemove?: () => void;
  small?: boolean;
  max?: number;
  /** The smallest amount this line can hold; one below it removes the line. */
  min?: number;
  /** How far one press moves; a case pack. */
  step?: number;
}

export function QuantityStepper({
  value,
  onChange,
  onRemove,
  small,
  max = 999,
  min = 1,
  step = 1,
}: QuantityStepperProps) {
  const each = Math.max(1, step);
  function dec() {
    const down = (Math.ceil(value / each) - 1) * each;
    if (down < Math.max(1, min)) onRemove?.();
    else onChange(down);
  }
  function inc() {
    const up = (Math.floor(value / each) + 1) * each;
    onChange(Math.min(max, Math.max(up, min)));
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
        min={Math.max(1, min)}
        step={each}
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
