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

import { useFieldValidation } from '@sparx/forms';

import { issueReturnRefundAction } from '../../../return-actions';

export function ReturnRefundForm({
  returnId,
  preferredOutcome,
}: {
  returnId: string;
  preferredOutcome: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState('');
  const [restockingFee, setRestockingFee] = React.useState('');
  const [asAccountCredit, setAsAccountCredit] = React.useState(
    preferredOutcome === 'account_credit'
  );

  const values = { amount, restockingFee, asAccountCredit };
  const v = useFieldValidation(values, {
    amount: (val) => {
      const raw = String(val).trim();
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) return 'Enter a refund amount.';
      if (n <= 0) return 'Refund amount must be greater than zero.';
      return null;
    },
    restockingFee: (val) => {
      const raw = String(val).trim();
      if (raw === '') return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 'Enter a number.';
      if (n < 0) return 'Restocking fee cannot be negative.';
      return null;
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;

    const amountValue = Number(amount.trim());
    const feeValue = restockingFee.trim() === '' ? 0 : Number(restockingFee.trim());

    startTransition(async () => {
      const result = await issueReturnRefundAction({
        returnId,
        refundAmountCents: Math.round(amountValue * 100),
        ...(feeValue > 0 ? { restockingFeeCents: Math.round(feeValue * 100) } : {}),
        asAccountCredit,
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
          <Field {...v.field('amount')} className="w-40">
            <FieldLabel required>Refund amount (dollars)</FieldLabel>
            <FieldControl
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              {...v.control('amount')}
            />
          </Field>
          <Field {...v.field('restockingFee')} className="w-40">
            <FieldLabel>Restocking fee (dollars)</FieldLabel>
            <FieldControl
              name="restockingFee"
              type="number"
              step="0.01"
              min="0"
              value={restockingFee}
              onChange={(e) => setRestockingFee(e.target.value)}
              {...v.control('restockingFee')}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox
            color="module"
            name="asAccountCredit"
            checked={asAccountCredit}
            onChange={(e) => setAsAccountCredit(e.target.checked)}
          />
          <span className="text-sm">
            Issue as account credit instead of refunding to original payment
          </span>
        </label>
        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}
        <div className="flex flex-row justify-end gap-2">
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Issuing…' : 'Issue refund'}
          </Button>
        </div>
      </div>
    </form>
  );
}
