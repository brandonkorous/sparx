'use client';

// Saying yes to a return.

import { useEffect, useState } from 'react';
import {
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Checkbox } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import {
  reasonLabel,
  returnErrorMessage,
  useApproveReturn,
  type ReturnDetail,
} from './returns-data';

/* ── Approve ────────────────────────────────────────────────────────────── */

/** Say yes to a return. Each line defaults to the quantity the customer asked
 *  for; lower any of them to accept only part of a line back. */
export function ApproveReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const approve = useApproveReturn(detail.id);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [generateLabel, setGenerateLabel] = useState(true);
  const [staffNote, setStaffNote] = useState('');

  // Reset to the requested quantities every time the modal opens, so a cancelled
  // attempt never leaves stale numbers behind for the next one.
  useEffect(() => {
    if (open) {
      setQuantities(Object.fromEntries(detail.items.map((it) => [it.id, String(it.quantity)])));
      setGenerateLabel(true);
      setStaffNote('');
    }
  }, [open, detail.items]);

  const submit = () => {
    const itemDecisions = detail.items.map((it) => ({
      returnLineItemId: it.id,
      approvedQuantity: Math.max(0, Math.floor(Number(quantities[it.id] ?? '0')) || 0),
    }));
    approve.mutate(
      { itemDecisions, generateLabel, staffNote: staffNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.add({ title: 'Return approved', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not approve this return',
            description: returnErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Approve this return"
      description="Accept the goods back. The customer is told it is approved, and a prepaid return label is bought automatically if you have a carrier connected."
      submitLabel="Approve return"
      busy={approve.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-3">
        {detail.items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
              <span className="text-sm">
                {reasonLabel(it.reasonCode)} · asked to return {it.quantity}
              </span>
            </div>
            <Field className="w-24">
              <FieldLabel>Accept back</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    type="number"
                    min="0"
                    max={String(it.quantity)}
                    className="text-right tabular-nums"
                    value={quantities[it.id] ?? ''}
                    aria-label={`Quantity to accept back for ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setQuantities((current) => ({ ...current, [it.id]: event.target.value }));
                    }}
                  />
                }
              />
            </Field>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={generateLabel}
          aria-label="Buy a prepaid return label automatically"
          onChange={(event) => {
            setGenerateLabel(event.target.checked);
          }}
        />
        <Text as="span">Buy a prepaid return label if a carrier is connected</Text>
      </label>

      <Field>
        <FieldLabel>Note for your team</FieldLabel>
        <Textarea
          color="module"
          rows={2}
          value={staffNote}
          placeholder="Optional — only your team sees this."
          aria-label="Note for your team"
          onChange={(event) => {
            setStaffNote(event.target.value);
          }}
        />
      </Field>
    </ActionDialog>
  );
}
