'use client';

// The core is not coming back: the deposit stays with the business.

import { useEffect, useState } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { formatMoney } from './data';
import {
  coreErrorMessage,
  plural,
  useKeepCoreDeposits,
  wholeCount,
  type CoreLine,
} from './cores-data';
import { ActionDialog } from './return-action-dialog';

function useKeepSubmit(line: CoreLine, onClose: () => void) {
  const toast = useToast();
  const keep = useKeepCoreDeposits();
  const submit = (quantity: number, note: string) => {
    keep.mutate(
      { orderItemId: line.orderItemId, body: { quantity, note } },
      {
        onSuccess: () => {
          toast.add({ title: `${plural(quantity, 'deposit', 'deposits')} kept`, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not keep the deposit',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: keep.isPending };
}

export function KeepDepositsModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const { owed } = line;
  const { submit, busy } = useKeepSubmit(line, onClose);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuantity(String(owed));
    setNote('');
  }, [open, owed]);

  const n = wholeCount(quantity);
  const valid = n > 0 && n <= owed && note.trim() !== '';

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Keep the core deposit"
      description={`For an old part that is not coming back. The ${formatMoney(line.depositCents / 100, line.currency)} deposit stays with you and no money moves. The line stops showing as owed.`}
      submitLabel={valid ? `Keep ${plural(n, 'deposit', 'deposits')}` : 'Keep the deposit'}
      submitDisabled={!valid}
      busy={busy}
      onSubmit={() => {
        submit(n, note.trim());
      }}
    >
      <KeepFields
        quantity={quantity}
        note={note}
        tooMany={n > owed}
        onQuantity={setQuantity}
        onNote={setNote}
      />
    </ActionDialog>
  );
}

function KeepFields({
  quantity,
  note,
  tooMany,
  onQuantity,
  onNote,
}: {
  quantity: string;
  note: string;
  tooMany: boolean;
  onQuantity: (next: string) => void;
  onNote: (next: string) => void;
}) {
  return (
    <>
      <KeepCount quantity={quantity} tooMany={tooMany} onQuantity={onQuantity} />
      <KeepReason note={note} onNote={onNote} />
    </>
  );
}

function KeepCount({
  quantity,
  tooMany,
  onQuantity,
}: {
  quantity: string;
  tooMany: boolean;
  onQuantity: (next: string) => void;
}) {
  return (
    <Field className="w-40">
      <FieldLabel>How many</FieldLabel>
      <FieldControl
        render={
          <Input
            color={tooMany ? 'error' : 'module'}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="tabular-nums"
            value={quantity}
            aria-label="Deposits to keep"
            onChange={(event) => {
              onQuantity(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

function KeepReason({ note, onNote }: { note: string; onNote: (next: string) => void }) {
  return (
    <Field>
      <FieldLabel required>Why</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={note}
            placeholder="For example: the customer is keeping the old part"
            onChange={(event) => {
              onNote(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>The customer will ask. This is kept with the order.</FieldDescription>
    </Field>
  );
}
