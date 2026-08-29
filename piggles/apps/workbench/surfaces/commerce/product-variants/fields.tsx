'use client';

// Two small fields the variant editor uses more than once.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
import { faPlus, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { MoneyInput } from '../../../components/money-input';

/** A money field that can be absent — "was" prices and cost are both optional,
 *  and an empty box is not the same as zero. */
export function OptionalMoney({
  label,
  description,
  value,
  addLabel,
  onChange,
}: {
  label: string;
  description: string;
  value: number | null;
  addLabel: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      {value === null ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            onClick={() => {
              onChange(0);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {addLabel}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <MoneyInput
            color="module"
            className="min-w-0 flex-1"
            value={value}
            aria-label={label}
            onValueChange={onChange}
          />
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            shape="square"
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={() => {
              onChange(null);
            }}
          >
            <Icon glyph={faXmark} className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

/** A whole-number measurement, for working out postage. */
export function WholeNumber({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>
        {label} ({unit})
      </FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            size="sm"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="text-right tabular-nums"
            value={value === null ? '' : String(value)}
            placeholder="—"
            onChange={(event) => {
              const next = event.target.value.trim();
              onChange(next === '' ? null : Math.max(0, Math.round(Number(next) || 0)));
            }}
          />
        }
      />
    </Field>
  );
}
