'use client';

// Old parts came back: refund the usable ones, keep the rest with a reason.

import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { receiveCoreWords } from './core-line-words';
import {
  coreErrorMessage,
  useCoreOpenInvoice,
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

/** Sends the count to the server and reports what it did with the money.
 *  `asksWhereMoneyGoes` is false when every deposit comes off the open invoice,
 *  so no "where to" was offered and none is sent. */
function useReceiveSubmit(
  line: CoreLine,
  form: ReceiveForm,
  asksWhereMoneyGoes: boolean,
  onClose: () => void
) {
  const toast = useToast();
  const receive = useReceiveCores();
  const submit = () => {
    const note = form.values.note.trim();
    const body = {
      usable: form.good,
      unusable: form.bad,
      refundTo: asksWhereMoneyGoes ? form.values.refundTo : ('original_payment' as const),
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
  const { owed } = line;
  const form = useReceiveForm(open, owed);
  // The order's open invoice: a returned deposit comes off it first (sparx persona
  // issue 183). Undefined while it loads, so the dialog promises nothing it has
  // not checked.
  const invoice = useCoreOpenInvoice(line.orderItemId, open);
  const words = receiveCoreWords(line, { usable: form.good, unusable: form.bad, invoice });
  const { submit, busy } = useReceiveSubmit(line, form, words.asksWhereMoneyGoes, onClose);

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Old part came back"
      description={words.description}
      submitLabel={form.valid ? words.submitLabel : 'Record the core'}
      submitColor={words.submitColor}
      submitDisabled={!form.valid || !words.ready}
      busy={busy}
      onSubmit={submit}
    >
      <ReceiveCoresFields form={form} owed={owed} asksWhereMoneyGoes={words.asksWhereMoneyGoes} />
    </ActionDialog>
  );
}
