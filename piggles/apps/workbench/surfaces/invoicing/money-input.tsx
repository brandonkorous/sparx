'use client';

// A money field that stays editable while you type and settles when you leave.
//
// A plain `<input type="number" value={125.5}>` renders "125.5", because a
// number has no concept of trailing zeros. On a price that reads as a mistake —
// nobody writes a hundred and twenty five dollars fifty as $125.5 — and it is
// the kind of detail that makes a billing screen feel untrustworthy.
//
// Formatting on every keystroke is worse: it fights the operator. Typing "12."
// would round to "12.00" before they reach the cents, and clearing the field to
// retype would snap back to "0.00" under the cursor.
//
// So: while focused the field holds exactly what was typed, and every keystroke
// still reports a parsed number upward so totals track live. On blur the text
// is replaced by the canonical two-decimal form.

import { useEffect, useState } from 'react';
import { Input } from '@wizeworks/silicaui-react';

interface MoneyInputProps {
  value: number;
  disabled?: boolean;
  'aria-label': string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Accent for the border + focus ring — matches the surrounding module. */
  color?: 'neutral' | 'primary' | 'module';
  onValueChange: (value: number) => void;
}

export function MoneyInput({
  value,
  disabled,
  className,
  size = 'sm',
  color,
  onValueChange,
  ...rest
}: MoneyInputProps) {
  const [text, setText] = useState(() => value.toFixed(2));
  const [editing, setEditing] = useState(false);

  // Track external changes (a document loading, a reset) — but never while the
  // field has focus, or reformatting would yank the caret mid-word.
  useEffect(() => {
    if (!editing) setText(value.toFixed(2));
  }, [value, editing]);

  return (
    <Input
      {...rest}
      size={size}
      {...(color ? { color } : {})}
      type="number"
      min={0}
      step={0.01}
      inputMode="decimal"
      disabled={disabled}
      className={`text-right tabular-nums ${className ?? ''}`}
      value={text}
      onFocus={() => {
        setEditing(true);
      }}
      onChange={(event) => {
        setText(event.target.value);
        // An empty field means zero for the running total, but the field itself
        // stays empty — replacing it with "0" as they type would be hostile.
        onValueChange(Number(event.target.value) || 0);
      }}
      onBlur={() => {
        setEditing(false);
        setText((Number(text) || 0).toFixed(2));
      }}
    />
  );
}
