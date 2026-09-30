'use client';

// WHICH COUNTRY — picked by name, never typed as a code.
//
// Every address in this console stores ISO 3166-1 alpha-2 ("US", "DE"), because
// that is what the schemas validate and what carriers and tax engines speak.
// For a long time every address FORM asked a shop owner to type it, and the
// Locations form went further and taught her the codes:
//
//     The two-letter country code: GB for the United Kingdom, US for the
//     United States, DE for Germany.
//
// That is a filing system asking to be learned. `lib/geo.ts` has said "a shop
// owner should never SEE a code" in its own header since it was written, and
// shipping and tax were the only two screens reading it. Issue 721.
//
// ── An existing value that is not a code is KEPT ────────────────────────────
//
// The scheduling address had no guidance at all, so one place is stored as
// "United States" rather than "US". A picker that silently dropped it would
// change her data by being opened. It is offered as its own option, marked, so
// she can see it and choose the real country herself.
// [[feedback_honor_the_users_choice]]

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Select,
} from '@wizeworks/silicaui-react';
import { countryOptions } from '../lib/geo';

interface CountryFieldProps {
  /** The stored value: a two-letter code, or whatever was typed before. */
  value: string;
  onChange: (next: string) => void;
  /** Whether it has to be filled in before this can be saved. */
  required?: boolean;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Every country by name, plus two entries that depend on what is there:
 * a way back to blank when the field is optional, and the current value when
 * it is not a country code we recognise.
 */
export function countryItems(
  value: string,
  required?: boolean
): { value: string; label: string }[] {
  const options = countryOptions();
  const known = options.some((option) => option.value === value);
  return [
    ...(required === true ? [] : [{ value: '', label: 'No country' }]),
    ...(value !== '' && !known ? [{ value, label: `${value} (not a country we know)` }] : []),
    ...options,
  ];
}

export function CountryField({
  value,
  onChange,
  required,
  label = 'Country',
  description,
  disabled,
}: CountryFieldProps) {
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
            items={countryItems(value, required)}
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
