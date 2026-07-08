'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Checkbox, Input, Label } from 'silicaui-react';

import { formBool, formNumber, formString } from '../../../../../../../lib/forms';
import { createTaxRateAction } from '../../../../tax-actions';

export function NewTaxRateForm({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = formString(form, 'name').trim();
    const percent = formNumber(form, 'percent');
    const appliesToShipping = formBool(form, 'appliesToShipping');
    const productTaxClass = formString(form, 'productTaxClass').trim();

    if (percent < 0 || percent > 100) {
      setError('Rate must be between 0 and 100%');
      return;
    }

    startTransition(async () => {
      const result = await createTaxRateAction({
        zoneId,
        name,
        rateBasisPoints: Math.round(percent * 100),
        appliesToShipping,
        ...(productTaxClass ? { productTaxClass } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap gap-3">
          <div className="flex min-w-[14rem] flex-col gap-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="California sales tax" />
          </div>
          <div className="flex w-32 flex-col gap-1">
            <Label htmlFor="percent">Rate (%) *</Label>
            <Input
              id="percent"
              name="percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              placeholder="8.25"
            />
          </div>
          <div className="flex min-w-[10rem] flex-col gap-1">
            <Label htmlFor="productTaxClass">Product tax class</Label>
            <Input
              id="productTaxClass"
              name="productTaxClass"
              placeholder="prepared_food"
              maxLength={63}
            />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox color="module" name="appliesToShipping" />
          <span className="text-sm">Apply this rate to shipping charges too</span>
        </label>
        {error && (
          <p className="text-danger text-sm" role="alert" aria-live="polite">
            {error}
          </p>
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
