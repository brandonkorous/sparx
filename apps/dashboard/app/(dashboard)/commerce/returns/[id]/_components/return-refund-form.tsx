'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Checkbox, Input } from 'silicaui-react';

import { formBool, formNumber } from '../../../../../../lib/forms';
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const amount = formNumber(form, 'amount');
    const restockingFee = formNumber(form, 'restockingFee');
    const asAccountCredit = formBool(form, 'asAccountCredit');

    if (amount <= 0) {
      setError('Refund amount must be greater than zero.');
      return;
    }

    startTransition(async () => {
      const result = await issueReturnRefundAction({
        returnId,
        refundAmountCents: Math.round(amount * 100),
        ...(restockingFee > 0 ? { restockingFeeCents: Math.round(restockingFee * 100) } : {}),
        asAccountCredit,
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
          <div className="flex w-40 flex-col gap-1">
            <p className="text-base-content/70 text-xs">Refund amount (dollars) *</p>
            <Input name="amount" type="number" step="0.01" min="0" required />
          </div>
          <div className="flex w-40 flex-col gap-1">
            <p className="text-base-content/70 text-xs">Restocking fee (dollars)</p>
            <Input name="restockingFee" type="number" step="0.01" min="0" />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox
            color="module"
            name="asAccountCredit"
            defaultChecked={preferredOutcome === 'account_credit'}
          />
          <span className="text-sm">
            Issue as account credit instead of refunding to original payment
          </span>
        </label>
        {error && (
          <p className="text-danger text-sm" role="alert" aria-live="polite">
            {error}
          </p>
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
