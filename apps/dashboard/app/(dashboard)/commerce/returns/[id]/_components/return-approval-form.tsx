'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Checkbox, FieldStatus, Input } from '@wizeworks/silicaui-react';

import { formBool, formString } from '../../../../../../lib/forms';
import { approveReturnAction } from '../../../return-actions';

interface ReturnLineItem {
  id: string;
  orderItemId: string;
  quantity: number;
  approvedQuantity: number;
  reasonCode: string;
}

export function ReturnApprovalForm({
  returnId,
  items,
}: {
  returnId: string;
  items: ReturnLineItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [approved, setApproved] = React.useState<Record<string, number>>(
    Object.fromEntries(items.map((it) => [it.id, it.quantity]))
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const staffNote = formString(form, 'staffNote').trim();
    const generateLabel = formBool(form, 'generateLabel');

    // Approved quantities are per-row inline editors — guard the numeric bounds
    // (finite integer, 0..requested) before dispatching.
    const outOfBounds = items.some((it) => {
      const q = approved[it.id] ?? it.quantity;
      return !Number.isInteger(q) || q < 0 || q > it.quantity;
    });
    if (outOfBounds) {
      setError('Approved quantities must be whole numbers between 0 and the requested amount.');
      return;
    }

    const itemDecisions = items.map((it) => ({
      returnLineItemId: it.id,
      approvedQuantity: approved[it.id] ?? it.quantity,
    }));

    startTransition(async () => {
      const result = await approveReturnAction({
        returnId,
        itemDecisions,
        generateLabel,
        ...(staffNote ? { staffNote } : {}),
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
        {items.map((it) => (
          <div key={it.id} className="flex flex-row items-center gap-3">
            <p className="w-32 font-mono text-xs">{it.orderItemId.slice(0, 8)}</p>
            <p className="text-base-content w-20 text-xs">req {it.quantity}</p>
            <Input
              type="number"
              min={0}
              max={it.quantity}
              value={approved[it.id] ?? it.quantity}
              onChange={(e) =>
                setApproved((prev) => ({ ...prev, [it.id]: Number(e.target.value) }))
              }
              className="w-24"
            />
            <p className="text-base-content text-xs">approved qty</p>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <Checkbox color="module" name="generateLabel" defaultChecked />
            <span className="text-sm">
              Generate return label (when ShippingProvider is installed)
            </span>
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base-content text-xs">Staff note (optional)</p>
          <Input name="staffNote" placeholder="Optional internal note" />
        </div>
        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}
        <div className="flex flex-row justify-end gap-2">
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Approving…' : 'Approve return'}
          </Button>
        </div>
      </div>
    </form>
  );
}
