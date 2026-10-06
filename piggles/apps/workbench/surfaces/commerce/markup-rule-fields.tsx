'use client';

// The two kinds of field the markup rule form is made of: a choice, and a number
// with its unit (sparx persona issue 086).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';

export function ChoiceField({
  label,
  value,
  items,
  onPick,
  help,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onPick: (next: string) => void;
  help?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <Select
              color="module"
              aria-label={label}
              value={value}
              items={items}
              onValueChange={(next) => {
                if (typeof next === 'string' && next) onPick(next);
              }}
            />
          </div>
        }
      />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  );
}

export function UnitField({
  label,
  unit,
  value,
  error,
  help,
  onChange,
}: {
  label: string;
  /** `$` goes before the number; anything else after it. */
  unit: string;
  value: string;
  error: string | null;
  help?: string;
  onChange: (next: string) => void;
}) {
  const unitText = (
    <Text as="span" className="text-sm">
      {unit}
    </Text>
  );
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <div className="flex max-w-40 items-center gap-1">
            {unit === '$' ? unitText : null}
            <Input
              color={error ? 'error' : 'module'}
              inputMode="decimal"
              className="text-right tabular-nums"
              aria-label={label}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
              }}
            />
            {unit === '$' || unit === '' ? null : unitText}
          </div>
        }
      />
      {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
      {!error && help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  );
}
