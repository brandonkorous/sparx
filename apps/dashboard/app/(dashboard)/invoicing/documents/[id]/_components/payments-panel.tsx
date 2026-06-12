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
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

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
  'flex h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

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
  { value: 'store_credit', label: 'Store credit' },
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

  function record() {
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter a positive amount.');
      return;
    }
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
      <CardHeader>
        <CardTitle>
          <Stack direction="row" align="center" gap={2}>
            Payments
            <Badge variant="outline">{payments.length}</Badge>
          </Stack>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <div className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-6 md:col-span-3">
              <Label className="text-xs">Type</Label>
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
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label className="text-xs">Method</Label>
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
            </div>
            <div className="col-span-5 md:col-span-2">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="text-right"
                value={amount}
                disabled={pending}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="col-span-7 md:col-span-3">
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                disabled={pending}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Check #, memo…"
              />
            </div>
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
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}

          {payments.length === 0 ? (
            <Text size="sm" variant="muted">
              No payments recorded yet.
            </Text>
          ) : (
            <Stack gap={1}>
              {payments.map((p) => (
                <Stack
                  key={p.id}
                  direction="row"
                  align="center"
                  justify="between"
                  className="rounded-md border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack direction="row" align="center" gap={3} wrap>
                    <Badge
                      color={p.kind === 'refund' ? 'danger' : 'neutral'}
                      variant="soft"
                      className="text-xs"
                    >
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </Badge>
                    <Text size="sm" className="capitalize">
                      {p.method.replace('_', ' ')}
                    </Text>
                    {p.reference && (
                      <Text size="xs" variant="muted">
                        {p.reference}
                      </Text>
                    )}
                    <Text size="xs" variant="muted">
                      {new Date(p.receivedAt).toLocaleDateString()}
                    </Text>
                  </Stack>
                  <Text size="sm" className="tabular-nums">
                    {p.kind === 'refund' ? '- ' : ''}
                    {formatMoney(p.amount, currency)}
                  </Text>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
