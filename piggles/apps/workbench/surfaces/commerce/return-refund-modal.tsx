'use client';

// Giving the customer their money back: the move that settles a refund and
// cannot be undone. It moves money only when a gateway holds the charge; money
// taken by hand is recorded here and handed back by a person (sparx persona
// issue 178).

import { useEffect, useState } from 'react';
import {
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';

import { MoneyTextInput } from '../../components/money-input';
import { ActionDialog, money } from './return-action-dialog';
import { paidTaxOf } from './return-refund-figures';
import { paidBackNote, refundWords } from './return-refund-words';
import { returnErrorMessage, useRefundReturn, type ReturnDetail } from './returns-data';

/** What the operator has typed, reset each time the dialog opens. */
function useRefundForm(open: boolean, suggestedCents: number) {
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [asCredit, setAsCredit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : '');
    setFee('');
    setAsCredit(false);
  }, [open, suggestedCents]);

  return {
    amount,
    fee,
    asCredit,
    setAmount,
    setFee,
    setAsCredit,
    amountCents: Math.round((Number(amount) || 0) * 100),
    feeCents: fee.trim() ? Math.round((Number(fee) || 0) * 100) : undefined,
  };
}

type RefundForm = ReturnType<typeof useRefundForm>;

/** Sends the refund. `doneTitle` names the whole figure, core deposits
 *  included, and says how it went back. */
function useRefundSubmit(detail: ReturnDetail, onClose: () => void) {
  const toast = useToast();
  const refund = useRefundReturn(detail.id);
  const submit = (form: RefundForm, doneTitle: string) => {
    refund.mutate(
      {
        refundAmountCents: form.amountCents,
        asAccountCredit: form.asCredit,
        ...(form.feeCents ? { restockingFeeCents: form.feeCents } : {}),
      },
      {
        onSuccess: () => {
          toast.add({ title: doneTitle, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not give the money back',
            description: returnErrorMessage(
              error,
              'The refund did not go through. Nothing was changed. You can try again.'
            ),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: refund.isPending };
}

function MoneyField({
  label,
  required,
  text,
  onText,
}: {
  label: string;
  required?: boolean;
  text: string;
  onText: (next: string) => void;
}) {
  return (
    <Field className="w-40">
      <FieldLabel required={required}>{label}</FieldLabel>
      <FieldControl
        render={
          <MoneyTextInput
            color="module"
            className="text-right"
            aria-label={label}
            text={text}
            onTextChange={onText}
          />
        }
      />
    </Field>
  );
}

function RefundFields({
  form,
  currency,
  coreBackCents,
  creditLabel,
  taxNote,
}: {
  form: RefundForm;
  currency: string;
  coreBackCents: number;
  creditLabel: string;
  /** The sales tax inside the amount, said once (sparx persona issue 231). */
  taxNote: string | null;
}) {
  return (
    <>
      <MoneyField label="Amount to give back" required text={form.amount} onText={form.setAmount} />
      {taxNote ? <Text>{taxNote}</Text> : null}
      {coreBackCents > 0 ? (
        <Text>
          Plus {money(coreBackCents, currency)} in core deposits, which go back with the parts: a
          part that comes back is its own core.
        </Text>
      ) : null}
      <MoneyField label="Restocking fee kept" text={form.fee} onText={form.setFee} />
      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={form.asCredit}
          aria-label="Give as store credit instead of the original payment"
          onChange={(event) => {
            form.setAsCredit(event.target.checked);
          }}
        />
        <Text as="span">{creditLabel}</Text>
      </label>
    </>
  );
}

export interface RefundReturnModalProps {
  detail: ReturnDetail;
  currency: string;
  /** A starting amount from the accepted lines, sales tax included; zero when
   *  prices are unknown. */
  suggestedCents: number;
  /** Core deposits that go back with the parts (issue 051). The server adds
   *  them itself; shown so the figure on the button is the one paid. */
  coreBackCents?: number;
  open: boolean;
  onClose: () => void;
}

/** Give the customer their money back: the move that settles the return and
 *  cannot be undone. */
export function RefundReturnModal(props: RefundReturnModalProps) {
  const { detail, currency, suggestedCents, coreBackCents = 0, open, onClose } = props;
  const form = useRefundForm(open, suggestedCents);
  const { submit, busy } = useRefundSubmit(detail, onClose);
  const valid = form.amountCents > 0 || coreBackCents > 0;
  const backCents = form.amountCents + coreBackCents;
  const words = refundWords({
    who: detail.customerName ?? 'the customer',
    amount: money(backCents, currency),
    byHand: detail.refundsByHand,
    asCredit: form.asCredit,
  });

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Give the money back"
      description={words.description}
      submitLabel={valid ? words.submitLabel : 'Give the money back'}
      submitColor="danger"
      submitDisabled={!valid}
      busy={busy}
      onSubmit={() => {
        submit(form, words.doneTitle);
      }}
    >
      <RefundFields
        form={form}
        currency={currency}
        coreBackCents={coreBackCents}
        creditLabel={words.creditLabel}
        taxNote={paidBackNote(paidTaxOf(detail), currency)}
      />
    </ActionDialog>
  );
}
