'use client';

// Ship a send-first line before its old part arrives (issue 057). Nothing is held
// against it once it goes, so the dialog says so and asks why.

import { useEffect, useState } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { coreErrorMessage, useReleaseCoreHold, type CoreLine } from './cores-data';
import { ActionDialog } from './return-action-dialog';

function useReleaseSubmit(line: CoreLine, onClose: () => void) {
  const toast = useToast();
  const release = useReleaseCoreHold();
  const submit = (note: string) => {
    release.mutate(
      { orderItemId: line.orderItemId, body: { note } },
      {
        onSuccess: () => {
          toast.add({
            title: `${line.name} can go now`,
            description: `The old part is still owed by ${line.customerName} and stays on your Cores owed list until it arrives.`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not stop waiting',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: release.isPending };
}

function ReleaseReason({ note, onNote }: { note: string; onNote: (next: string) => void }) {
  return (
    <Field>
      <FieldLabel required>Why it can go now</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={note}
            placeholder="For example: fleet customer, truck is off the road"
            onChange={(event) => {
              onNote(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>Kept with the order, for whoever opens it next.</FieldDescription>
    </Field>
  );
}

export function ReleaseHoldModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const { submit, busy } = useReleaseSubmit(line, onClose);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const them = line.waiting === 1 ? 'it' : 'them';
  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title={`Stop waiting for the old part for ${line.name}?`}
      description={`${line.customerName} chose to send the old part first and paid no deposit. If ${line.waiting === 1 ? 'this part goes' : `these ${String(line.waiting)} parts go`} now, nothing is held against ${them}: if the old part never comes, there is no deposit to keep.`}
      submitLabel="Don't wait for the old part"
      submitColor="warning"
      submitDisabled={note.trim() === ''}
      busy={busy}
      onSubmit={() => {
        submit(note.trim());
      }}
    >
      <ReleaseReason note={note} onNote={setNote} />
    </ActionDialog>
  );
}
