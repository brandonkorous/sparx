'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';

import { rule, useFieldValidation } from '@sparx/forms';

import { createTaxRateAction } from '../../../../tax-actions';

export function NewTaxRateForm({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [percent, setPercent] = React.useState('');
  const [productTaxClass, setProductTaxClass] = React.useState('');
  const [appliesToShipping, setAppliesToShipping] = React.useState(false);

  const values = { name, percent, productTaxClass, appliesToShipping };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    percent: (val) => {
      const raw = String(val).trim();
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) return 'Enter a rate.';
      if (n < 0) return 'Rate cannot be negative.';
      if (n > 100) return 'Rate must be between 0 and 100%.';
      return null;
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;

    const trimmedName = name.trim();
    const percentValue = Number(percent.trim());
    const trimmedClass = productTaxClass.trim();

    startTransition(async () => {
      const result = await createTaxRateAction({
        zoneId,
        name: trimmedName,
        rateBasisPoints: Math.round(percentValue * 100),
        appliesToShipping,
        ...(trimmedClass ? { productTaxClass: trimmedClass } : {}),
      });
      if (!result.ok) {
        const known = (result.error.details ?? []).filter((d) => d.field in values);
        if (known.length) {
          v.setServerErrors(Object.fromEntries(known.map((d) => [d.field, d.message])));
        } else {
          setError(result.error.message);
        }
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap gap-3">
          <Field {...v.field('name')} className="min-w-[14rem]">
            <FieldLabel required>Name</FieldLabel>
            <FieldControl
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="California sales tax"
              {...v.control('name')}
            />
          </Field>
          <Field {...v.field('percent')} className="w-32">
            <FieldLabel required>Rate (%)</FieldLabel>
            <FieldControl
              name="percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="8.25"
              {...v.control('percent')}
            />
          </Field>
          <Field className="min-w-[10rem]">
            <FieldLabel>Product tax class</FieldLabel>
            <FieldControl
              name="productTaxClass"
              value={productTaxClass}
              onChange={(e) => setProductTaxClass(e.target.value)}
              placeholder="prepared_food"
              maxLength={63}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox
            color="module"
            name="appliesToShipping"
            checked={appliesToShipping}
            onChange={(e) => setAppliesToShipping(e.target.checked)}
          />
          <span className="text-sm">Apply this rate to shipping charges too</span>
        </label>
        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}
        <div className="flex flex-row justify-end gap-2">
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add rate'}
          </Button>
        </div>
      </div>
    </form>
  );
}
