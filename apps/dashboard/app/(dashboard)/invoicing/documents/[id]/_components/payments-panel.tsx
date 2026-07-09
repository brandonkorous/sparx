'use client';

// Payments panel (docs/87 §8) — record a deposit / payment / refund and see the
// append-only ledger. Recording recomputes the document's amount-paid / balance /
// AR status server-side (the single money authority), so the panel just refreshes.
// Allowed even on a locked document — locking freezes the lines, not the act of
// paying.

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

import { recordPaymentAction } from '../../../document-actions';
import { formatMoney } from '../../../_components/format';

interface PaymentRow {
  id: string;
  kind: string;
  method: string;
  amount: number;
  reference: string | null;
  receivedAt: string;
}

interface PaymentsPanelProps {
  documentId: string;
  currency: string;
  balance: number;
  payments: PaymentRow[];
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-base-300 bg-base-100 px-2 text-sm text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const KIND_OPTIONS = [
  { value: 'payment', label: 'Payment' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'refund', label: 'Refund' },
];
const METHOD_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire' },
  { value: 'account_credit', label: 'Account credit' },
  { value: 'other', label: 'Other' },
];
const KIND_LABEL: Record<string, string> = {
  payment: 'Payment',
  deposit: 'Deposit',
  refund: 'Refund',
};

export function PaymentsPanel({ documentId, currency, balance, payments }: PaymentsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState('payment');
  const [method, setMethod] = React.useState('card');
  const [amount, setAmount] = React.useState(balance > 0 ? String(balance.toFixed(2)) : '');
  const [reference, setReference] = React.useState('');

  const v = useFieldValidation(
    { amount },
    {
      amount: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a valid amount.';
        if (n <= 0) return 'Enter a positive amount.';
        return null;
      },
    }
  );

  function record() {
    setError(null);
    if (!v.validate()) return;
    const amt = Number(amount);
    startTransition(async () => {
      setError(null);
      const res = await recordPaymentAction(documentId, {
        kind,
        method,
        amount: amt,
        reference: reference.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setReference('');
      setAmount('');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>
          <div className="flex flex-row items-center gap-2">
            Payments
            <Badge color="neutral" variant="soft" size="sm">
              {payments.length}
            </Badge>
          </div>
        </CardTitle>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-12 items-end gap-2">
            <Field className="col-span-6 md:col-span-3">
              <FieldLabel className="text-xs">Type</FieldLabel>
              <select
                className={SELECT_CLASS}
                value={kind}
                disabled={pending}
                onChange={(e) => setKind(e.target.value)}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field className="col-span-6 md:col-span-3">
              <FieldLabel className="text-xs">Method</FieldLabel>
              <select
                className={SELECT_CLASS}
                value={method}
                disabled={pending}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field {...v.field('amount')} className="col-span-5 md:col-span-2">
              <FieldLabel className="text-xs" required>
                Amount
              </FieldLabel>
              <FieldControl
                name="amount"
                type="number"
                min="0"
                step="0.01"
                className="text-right"
                value={amount}
                disabled={pending}
                onChange={(e) => setAmount(e.target.value)}
                {...v.control('amount')}
              />
            </Field>
            <Field className="col-span-7 md:col-span-3">
              <FieldLabel className="text-xs">Reference</FieldLabel>
              <FieldControl
                name="reference"
                value={reference}
                disabled={pending}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Check #, memo…"
              />
            </Field>
            <div className="col-span-12 flex md:col-span-1 md:justify-end">
              <Button
                type="button"
                color="module"
                size="sm"
                disabled={pending}
                loading={pending}
                onClick={record}
              >
                Record
              </Button>
            </div>
          </div>

          {error && (
            <FieldStatus status="error" attached={false} role="alert">
              {error}
            </FieldStatus>
          )}

          {payments.length === 0 ? (
            <p className="text-base-content/70 text-sm">No payments recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="border-base-300 flex flex-row items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex flex-row flex-wrap items-center gap-3">
                    <Badge
                      color={p.kind === 'refund' ? 'danger' : 'neutral'}
                      variant="soft"
                      className="text-xs"
                    >
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </Badge>
                    <p className="text-sm capitalize">{p.method.replace('_', ' ')}</p>
                    {p.reference && <p className="text-base-content/70 text-xs">{p.reference}</p>}
                    <p className="text-base-content/70 text-xs">
                      {new Date(p.receivedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {p.kind === 'refund' ? '- ' : ''}
                    {formatMoney(p.amount, currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
