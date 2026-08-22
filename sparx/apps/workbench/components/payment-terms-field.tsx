'use client';

// The control for "how long they have to pay".
//
// Presets first, because most agreements are a round number and the usual case
// should stay one click. Then "A different number of days", because terms are
// what two businesses agreed and a menu cannot know that — a bakery on Net 14
// with two cafés had to choose between 15 and 30, and either one puts a wrong
// due date on a real invoice.
//
// The days box appears only when it is wanted, and it opens ALREADY OPEN on a
// company whose stored terms are not a preset — otherwise editing anything else
// on the form would silently re-round their agreement to the nearest option.

import { useState } from 'react';
import { Input, Select } from '@wizeworks/silicaui-react';
import {
  MAX_TERM_DAYS,
  PAYMENT_TERMS_CUSTOM,
  PAYMENT_TERM_PRESETS,
  isCustomTerm,
  paymentTermsDays,
  termsFromDays,
} from '../lib/payment-terms';

const NONE = '';

export function PaymentTermsField({
  value,
  onChange,
}: {
  /** The stored value: `''`, `prepay`, or `netN`. */
  value: string;
  onChange: (next: string) => void;
}) {
  const [showDays, setShowDays] = useState(() => isCustomTerm(value));
  const [days, setDays] = useState(() => {
    const parsed = paymentTermsDays(value);
    return isCustomTerm(value) && parsed !== null ? String(parsed) : '';
  });

  const selected = showDays ? PAYMENT_TERMS_CUSTOM : value;

  function pick(next: string) {
    if (next === PAYMENT_TERMS_CUSTOM) {
      setShowDays(true);
      // Deliberately does NOT write yet. Nothing has been agreed until a number
      // is typed, and writing `net0` here would record "due immediately".
      return;
    }
    setShowDays(false);
    setDays('');
    onChange(next);
  }

  function typeDays(raw: string) {
    setDays(raw);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TERM_DAYS) return;
    onChange(termsFromDays(parsed));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-[13rem] flex-1">
        <Select
          color="module"
          aria-label="Payment terms"
          value={selected}
          items={{
            [NONE]: 'No agreed terms',
            ...Object.fromEntries(PAYMENT_TERM_PRESETS.map((t) => [t.value, t.label])),
            [PAYMENT_TERMS_CUSTOM]: 'A different number of days…',
          }}
          onValueChange={(next) => {
            pick((next as string | null) ?? NONE);
          }}
        />
      </div>
      {showDays ? (
        <label className="flex items-center gap-2">
          <Input
            color="module"
            className="w-20"
            inputMode="numeric"
            aria-label="Days to pay"
            value={days}
            onChange={(event) => {
              typeDays(event.target.value);
            }}
          />
          <span className="text-base">days to pay</span>
        </label>
      ) : null}
    </div>
  );
}
