'use client';

// Old parts came back: refund the usable ones, keep the rest with a reason.

import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { formatMoney } from './data';
import {
  coreErrorMessage,
  plural,
  useReceiveCores,
  wholeCount,
  type CoreLine,
  type CoreRefundRoute,
} from './cores-data';
import { ActionDialog } from './return-action-dialog';
import { ReceiveCoresFields } from './order-cores-receive-fields';

/** The form's typed values, reset each time the dialog opens. */
function useReceiveForm(open: boolean, owed: number) {
  const [usable, setUsable] = useState('');
  const [unusable, setUnusable] = useState('');
  const [note, setNote] = useState('');
  const [refundTo, setRefundTo] = useState<CoreRefundRoute>('original_payment');

  useEffect(() => {
    if (!open) return;
    setUsable(String(owed));
    setUnusable('0');
    setNote('');
    setRefundTo('original_payment');
  }, [open, owed]);

  const good = wholeCount(usable);
  const bad = wholeCount(unusable);
  const tooMany = good + bad > owed;
  const needsReason = bad > 0 && note.trim() === '';
  return {
    values: { usable, unusable, note, refundTo },
    set: { setUsable, setUnusable, setNote, setRefundTo },
    good,
    bad,
    tooMany,
    needsReason,
    valid: good + bad > 0 && !tooMany && !needsReason,
  };
}

export type ReceiveForm = ReturnType<typeof useReceiveForm>;

function submitLabel(form: ReceiveForm, back: number, currency: string): string {
  if (!form.valid) return 'Record the core';
  if (back > 0) return `Give back ${formatMoney(back, currency)}`;
  return `Keep ${plural(form.bad, 'deposit', 'deposits')}`;
}

/** Sends the count to the server and reports what it did with the money. */
function useReceiveSubmit(line: CoreLine, form: ReceiveForm, onClose: () => void) {
  const toast = useToast();
  const receive = useReceiveCores();
  const submit = () => {
    const note = form.values.note.trim();
    const body = {
      usable: form.good,
      unusable: form.bad,
      refundTo: form.values.refundTo,
      ...(note ? { note } : {}),
    };
    receive.mutate(
      { orderItemId: line.orderItemId, body },
      {
        onSuccess: (settlement) => {
          toast.add({ title: 'Core recorded', description: settlement.summary, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the core',
            description: coreErrorMessage(
              error,
              'Nothing was changed and no money moved. You can try again.'
            ),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: receive.isPending };
}

/** Old parts came back on a deposit line. */
export function ReceiveCoresModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const { owed, currency } = line;
  const form = useReceiveForm(open, owed);
  const { submit, busy } = useReceiveSubmit(line, form, onClose);
  const deposit = line.depositCents / 100;
  const back = form.good * deposit;

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Old part came back"
      description={`${line.name}: ${plural(owed, 'core is', 'cores are')} still owed by ${line.customerName}. A usable core gets its ${formatMoney(deposit, currency)} deposit back. If this order has an invoice still open, the deposit comes off that invoice first.`}
      submitLabel={submitLabel(form, back, currency)}
      submitColor={back > 0 ? 'danger' : 'module'}
      submitDisabled={!form.valid}
      busy={busy}
      onSubmit={submit}
    >
      <ReceiveCoresFields form={form} owed={owed} />
    </ActionDialog>
  );
}
