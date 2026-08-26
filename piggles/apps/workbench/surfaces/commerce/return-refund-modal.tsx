'use client';

// Giving the customer their money back — the move that settles a refund,
// moves real money, and cannot be undone.

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
import { returnErrorMessage, useRefundReturn, type ReturnDetail } from './returns-data';

/* ── Refund ─────────────────────────────────────────────────────────────── */

/** Give the customer their money back — the move that settles the return, moves
 *  real money, and cannot be undone. */
export function RefundReturnModal({
  detail,
  currency,
  suggestedCents,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  currency: string;
  /** A starting amount worked out from the accepted lines, when the order's
   *  prices are known. Zero when they are not — the operator then types it. */
  suggestedCents: number;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const refund = useRefundReturn(detail.id);
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [asCredit, setAsCredit] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : '');
      setFee('');
      setAsCredit(false);
    }
  }, [open, suggestedCents]);

  const amountCents = Math.round((Number(amount) || 0) * 100);
  const feeCents = fee.trim() ? Math.round((Number(fee) || 0) * 100) : undefined;
  const valid = amountCents > 0;

  const submit = () => {
    refund.mutate(
      {
        refundAmountCents: amountCents,
        asAccountCredit: asCredit,
        ...(feeCents ? { restockingFeeCents: feeCents } : {}),
      },
      {
        onSuccess: () => {
          toast.add({
            title: `${money(amountCents, currency)} given back`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not give the money back',
            description: returnErrorMessage(
              error,
              'The refund did not go through. Nothing was changed — you can try again.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const who = detail.customerName ?? 'the customer';

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Give the money back"
      description={
        asCredit
          ? `${who} gets this as store credit to spend with you later. This settles the return and cannot be undone.`
          : `${who} gets this back the way they paid. This moves real money and cannot be undone.`
      }
      submitLabel={valid ? `Give back ${money(amountCents, currency)}` : 'Give the money back'}
      submitColor="danger"
      submitDisabled={!valid}
      busy={refund.isPending}
      onSubmit={submit}
    >
      <Field className="w-40">
        <FieldLabel required>Amount to give back</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              className="text-right"
              aria-label="Amount to give back"
              text={amount}
              onTextChange={setAmount}
            />
          }
        />
      </Field>

      <Field className="w-40">
        <FieldLabel>Restocking fee kept</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              className="text-right"
              aria-label="Restocking fee kept"
              text={fee}
              onTextChange={setFee}
            />
          }
        />
      </Field>

      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={asCredit}
          aria-label="Give as store credit instead of the original payment"
          onChange={(event) => {
            setAsCredit(event.target.checked);
          }}
        />
        <Text as="span">Give as store credit instead of back to their card</Text>
      </label>
    </ActionDialog>
  );
}
