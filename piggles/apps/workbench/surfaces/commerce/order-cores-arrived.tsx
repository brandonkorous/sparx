'use client';

// The old part arrived on a send-first line (issue 057). No money moves: nothing
// was paid. Each one that arrives lets one part ship.

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
import { coreErrorMessage, plural, useReceiveCores, wholeCount, type CoreLine } from './cores-data';
import { ActionDialog } from './return-action-dialog';

function useArrivedSubmit(line: CoreLine, onClose: () => void) {
  const toast = useToast();
  const receive = useReceiveCores();
  const submit = (arrived: number, note: string) => {
    receive.mutate(
      {
        orderItemId: line.orderItemId,
        body: {
          usable: arrived,
          unusable: 0,
          refundTo: 'original_payment',
          ...(note ? { note } : {}),
        },
      },
      {
        onSuccess: (settlement) => {
          const title = `${plural(arrived, 'old part', 'old parts')} in`;
          toast.add({ title, description: settlement.summary, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the old part',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: receive.isPending };
}

function ArrivedCount({
  arrived,
  owed,
  onArrived,
}: {
  arrived: string;
  owed: number;
  onArrived: (next: string) => void;
}) {
  const tooMany = wholeCount(arrived) > owed;
  return (
    <>
      <Field className="w-48">
        <FieldLabel>How many arrived</FieldLabel>
        <FieldControl
          render={
            <Input
              color={tooMany ? 'error' : 'module'}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="tabular-nums"
              value={arrived}
              aria-label="Old parts that arrived"
              onChange={(event) => {
                onArrived(event.target.value);
              }}
            />
          }
        />
      </Field>
      {tooMany ? (
        <p className="text-error text-sm" role="alert">
          Only {plural(owed, 'old part is', 'old parts are')} still to come on this line.
        </p>
      ) : null}
    </>
  );
}

function ArrivedNote({ note, onNote }: { note: string; onNote: (next: string) => void }) {
  return (
    <Field>
      <FieldLabel>Anything to note</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={note}
            placeholder="For example: came in by courier, box was damaged"
            onChange={(event) => {
              onNote(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>Optional. Kept with the order.</FieldDescription>
    </Field>
  );
}

export function OldPartArrivedModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const { submit, busy } = useArrivedSubmit(line, onClose);
  const [arrived, setArrived] = useState('');
  const [note, setNote] = useState('');
  const { owed } = line;

  useEffect(() => {
    if (!open) return;
    setArrived(String(owed));
    setNote('');
  }, [open, owed]);

  const n = wholeCount(arrived);
  const valid = n > 0 && n <= owed;

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Old part arrived"
      description={`${line.name}: ${line.customerName} is sending the old part first, so nothing was paid as a deposit and no money moves. Each old part that arrives lets one part ship. Only record one that can be rebuilt. If it cannot, leave the line waiting and ask the customer for another.`}
      submitLabel={valid ? `Record ${plural(n, 'old part', 'old parts')}` : 'Record the old part'}
      submitDisabled={!valid}
      busy={busy}
      onSubmit={() => {
        submit(n, note.trim());
      }}
    >
      <ArrivedCount arrived={arrived} owed={owed} onArrived={setArrived} />
      <ArrivedNote note={note} onNote={setNote} />
    </ActionDialog>
  );
}
