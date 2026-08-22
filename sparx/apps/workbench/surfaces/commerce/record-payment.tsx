'use client';

// Recording money the business took itself.
//
// `POST /v1/orders/:id/payments` has always existed and nothing in either
// console called it. The order pane listed payments and said "No payment has
// been recorded against this order yet" — true, and permanently true, because
// there was no way to record one.
//
// That is what made **Manual payments** unusable. The provider picker offers it
// and describes it as "you mark each order paid yourself"; a business that took
// the offer could place orders and never finish one. For a bakery whose whole
// model is money at the counter, the shop could take an order and never close it.
//
// ── WHY THE WORDS ARE THESE WORDS ───────────────────────────────────────────
//
// "processor", "captured", "processorRef" are the API's vocabulary and none of
// them are hers. She took some money; she wants to write down how much and how.
// So: **How they paid**, and a reference box that says what it is for rather
// than what the column is called.

import { useState } from 'react';
import { Button, Input, NativeSelect, useToast } from '@wizeworks/silicaui-react';
import { formatMoney, useRecordOrderPayment, type Order } from './data';
import { orderErrorMessage } from './data';

/** The ways a business takes money by hand. `stripe`/`paypal` are deliberately
 *  absent: a gateway records its own payments, and offering them here invites
 *  somebody to type in a card sale that never happened. */
const WAYS = [
  { value: 'manual', label: 'Cash' },
  { value: 'check', label: 'Cheque' },
  { value: 'wire', label: 'Bank transfer' },
] as const;

export function RecordPayment({ order, due }: { order: Order; due: number }) {
  const record = useRecordOrderPayment(order.id);
  const toast = useToast();
  // Prefilled with what is outstanding, because paying it off in full is the
  // common case — and it is an INPUT, so a part payment is just typing over it.
  const [amount, setAmount] = useState(due > 0 ? due.toFixed(2) : '');
  const [way, setWay] = useState<string>('manual');
  const [reference, setReference] = useState('');

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    record.mutate(
      { amount: parsed, currency: order.currency, processor: way, reference },
      {
        onSuccess: () => {
          setReference('');
          toast.add({
            title: `${formatMoney(parsed, order.currency)} written down`,
            description: 'The order shows what is left to pay.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not write that down',
            description: orderErrorMessage(
              error,
              'Nothing changed on this order. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-base-300 mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
    >
      <label className="flex min-w-[8rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">How much they paid</span>
        <Input
          value={amount}
          inputMode="decimal"
          onChange={(event) => {
            setAmount(event.target.value);
          }}
        />
      </label>
      <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">How they paid</span>
        <NativeSelect
          value={way}
          onChange={(event) => {
            setWay(event.target.value);
          }}
        >
          {WAYS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Anything to note (optional)</span>
        <Input
          value={reference}
          placeholder="Cheque number, who took it…"
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
      </label>
      <Button type="submit" color="primary" disabled={!valid} loading={record.isPending}>
        Write it down
      </Button>
    </form>
  );
}
