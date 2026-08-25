'use client';

// THE money field. Anywhere a person types an amount, this is what they type into.
//
// It lives here rather than under invoicing because money is not an invoicing
// idea: a service price, a deposit, a gift card, an amount to give back and a
// cost each are all the same question. It was invoicing-only, and the field it
// was written to replace went on shipping everywhere else — a salon priced a cut
// at "65,00" and got 6500 (issue 086).
//
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
//
// ── WHY THIS IS NOT `type="number"` ─────────────────────────────────────────
//
// It was, and a browser number field REFUSES text it cannot parse by handing
// back the empty string. So typing `8,50` — a comma for the cents, which is how
// most of the world writes money — arrived at `onChange` as `''`, was reported
// upward as `Number('') || 0`, and settled on blur to "0.00". A price became
// free, silently, with the field showing a number she never typed. Same for
// `$8.00` and `1,250.00`.
//
// A text field plus `readMoney` reads all three, and hands unreadable text back
// unchanged instead of inventing a zero.

import { useEffect, useState } from 'react';
import { Input } from '@wizeworks/silicaui-react';
import { readMoney, settleMoney } from '@/lib/read-money';

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
      type="text"
      inputMode="decimal"
      disabled={disabled}
      className={`text-right tabular-nums ${className ?? ''}`}
      value={text}
      onFocus={(event) => {
        setEditing(true);
        // SELECT what is there. The field opens holding a real "0.00", so a caret
        // dropped in front of it turns 9.00 into 9.000.00 — a delivery charge, or a
        // price, a thousand times over (issues 169 and 205).
        event.target.select();
      }}
      onChange={(event) => {
        setText(event.target.value);
        // An empty field means zero for the running total, but the field itself
        // stays empty — replacing it with "0" as they type would be hostile.
        // Half-typed text ("8," on the way to "8,50") keeps the last amount
        // that COULD be read rather than dropping the total to zero mid-word.
        const { amount } = readMoney(event.target.value, { allowZero: true });
        if (amount !== null) onValueChange(amount);
        else if (event.target.value.trim() === '') onValueChange(0);
      }}
      onBlur={() => {
        setEditing(false);
        setText((current) => settleMoney(current, { allowZero: true }));
      }}
    />
  );
}

/**
 * An OPTIONAL amount — one that can be left blank and mean "none".
 *
 * A service with no price is free; a discount with no amount is not a discount
 * yet. `MoneyInput` above cannot express that, because a number field has no
 * blank: it would report 0, and 0 and "not set" are different answers.
 *
 * So this one owns the TEXT and hands back both readings — the amount when it
 * can be read, and the sentence to show when it cannot. A caller that ignores
 * `problem` is back where issue 086 started, so it is not optional in the type.
 */
export function MoneyTextInput({
  text,
  disabled,
  className,
  size = 'md',
  color,
  onTextChange,
  ...rest
}: {
  text: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Whatever the surrounding module uses, plus `error` for a field the caller
   *  has already decided is wrong for its own reasons. */
  color?: 'neutral' | 'primary' | 'module' | 'error';
  onTextChange: (text: string) => void;
}) {
  return (
    <Input
      {...rest}
      size={size}
      {...(color ? { color } : {})}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder="0.00"
      className={`tabular-nums ${className ?? ''}`}
      value={text}
      onChange={(event) => {
        onTextChange(event.target.value);
      }}
      onBlur={() => {
        onTextChange(settleMoney(text, { allowZero: true }));
      }}
    />
  );
}

/** What to show under a `MoneyTextInput`, or null when there is nothing wrong.
 *  Blank is not wrong — it means "none". */
export function moneyProblem(text: string): string | null {
  if (text.trim() === '') return null;
  return readMoney(text, { allowZero: true }).problem;
}

/** A typed optional amount → integer cents. Blank is zero; unreadable is null,
 *  which a caller must refuse to save rather than quietly write as free. */
export function moneyCents(text: string): number | null {
  if (text.trim() === '') return 0;
  const { amount } = readMoney(text, { allowZero: true });
  return amount === null ? null : Math.round(amount * 100);
}
