'use client';

// WHICH CURRENCY — picked by name, never typed as a code.
//
// Five screens in this console asked a shop owner to type three letters into an
// empty box, and two more listed the codes with no names beside them. `USD` is
// a filing system asking to be learned, and unlike a country code she never
// sees it written anywhere except on the paperwork she is copying from.
//
// `lib/currency.ts` holds the list and says why. Issue 730.
//
// ── An existing value that is not one of ours is KEPT ───────────────────────
//
// Nothing ever validated these boxes beyond "three letters", so a stored value
// may be a code this platform cannot name. A picker that silently dropped it
// would change her data by being opened. It is offered as its own option,
// marked, so she can see it and choose the real currency herself.
// [[feedback_honor_the_users_choice]]

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Select,
} from '@wizeworks/silicaui-react';

import { currencyItems } from '../lib/currency';

interface CurrencyFieldProps {
  /** The stored value: an ISO 4217 code, or whatever was typed before. */
  value: string;
  onChange: (next: string) => void;
  /** Whether it has to be filled in before this can be saved. */
  required?: boolean;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function CurrencyField({
  value,
  onChange,
  required,
  label = 'Currency',
  description,
  disabled,
}: CurrencyFieldProps) {
  return (
    <Field>
      <FieldLabel required={required}>{label}</FieldLabel>
      <FieldControl
        render={
          <Select
            color="module"
            aria-label={label}
            disabled={disabled}
            value={value}
            items={currencyItems(value, required)}
            onValueChange={(next) => {
              onChange((next as string | null) ?? '');
            }}
          />
        }
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}
