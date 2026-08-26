'use client';

// Turning a return down.

import { useEffect, useState } from 'react';
import { Field, FieldLabel, Textarea, useToast } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import { returnErrorMessage, useDenyReturn, type ReturnDetail } from './returns-data';

/** Turn a return down. A reason is required — it is kept on the record and is
 *  what the customer is told. */
export function DenyReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const deny = useDenyReturn(detail.id);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const submit = () => {
    deny.mutate(
      { reason: reason.trim() },
      {
        onSuccess: () => {
          toast.add({ title: 'Return turned down', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not turn down this return',
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
      title="Turn down this return"
      description="The customer keeps the item and no money changes hands. They are told the reason you give here."
      submitLabel="Turn it down"
      submitColor="danger"
      submitDisabled={reason.trim().length === 0}
      busy={deny.isPending}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel required>Reason</FieldLabel>
        <Textarea
          color="module"
          rows={3}
          value={reason}
          placeholder="Why are you turning this return down?"
          aria-label="Reason for turning down the return"
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </Field>
    </ActionDialog>
  );
}
