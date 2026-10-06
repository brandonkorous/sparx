'use client';

// What they handed over.
//
// Prefilled with the total, core deposits included, because at a counter the
// whole thing is paid nearly every time. It is still a box, so a part payment is
// typing over it and a slip nobody has paid for yet is clearing it.
//
// WHAT the box is prefilled with is `whatToOffer` in sale-taking.ts, not this
// file: an order going out on a business's account asks for nothing. The
// sentence under the heading comes with it, since "how much you were handed" is a
// question about a counter and this pane is also where a phoned-in order is
// written down.

import { Input, NativeSelect, Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { paymentMethodLabel } from '../../lib/payment-methods';
import { readMoney, settleMoney } from '../../lib/read-money';
import { formatMoney } from './data';

/** The ways money reaches a counter. `card` is the business's OWN reader, not a
 *  gateway: `stripe`/`paypal` write their own records and are deliberately
 *  absent, since offering them here invites typing in a charge that never
 *  happened. */
const WAYS = (['manual', 'card', 'check', 'wire'] as const).map((value) => ({
  value,
  label: paymentMethodLabel(value),
}));

export function SalePayment({
  total,
  currency,
  paid,
  setPaid,
  paidWith,
  setPaidWith,
  paidNote,
  setPaidNote,
  note,
}: {
  /** What the sale comes to, deposits included. */
  total: number;
  currency: string;
  paid: string;
  setPaid: (value: string) => void;
  paidWith: string;
  setPaidWith: (value: string) => void;
  paidNote: string;
  setPaidNote: (value: string) => void;
  /** What this section is for, in the words that fit who is buying. */
  note: string;
}) {
  const { amount, problem } = readMoney(paid);
  const taken = amount ?? 0;
  const owing = total - taken;

  return (
    <FormSection title="What they paid" description={note}>
      <div className="flex flex-wrap items-start gap-3">
        <label className="w-32">
          <span className="mb-1.5 block text-base font-medium">How much</span>
          <Input
            color={problem ? 'danger' : 'module'}
            inputMode="decimal"
            className="text-right tabular-nums"
            value={paid}
            {...(problem ? { 'aria-invalid': true } : {})}
            onFocus={(event) => {
              event.target.select();
            }}
            onChange={(event) => {
              setPaid(event.target.value);
            }}
            onBlur={() => {
              setPaid(settleMoney(paid));
            }}
          />
          {problem ? <span className="text-danger block text-base">{problem}</span> : null}
        </label>

        <label className="min-w-[9rem]">
          <span className="mb-1.5 block text-base font-medium">How they paid</span>
          <NativeSelect
            color="module"
            value={paidWith}
            disabled={taken <= 0}
            onChange={(event) => {
              setPaidWith(event.target.value);
            }}
          >
            {WAYS.map((way) => (
              <option key={way.value} value={way.value}>
                {way.label}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-base font-medium">Anything to note (optional)</span>
          <Input
            color="module"
            value={paidNote}
            disabled={taken <= 0}
            placeholder="Check number, who took it…"
            onChange={(event) => {
              setPaidNote(event.target.value);
            }}
          />
        </label>
      </div>

      {/* The sentence that stops a mistyped amount going through unnoticed. It
          says what will be TRUE after saving, not what was typed. Silent until
          something is on the sale: "Paid in full: $0.00" on an empty till is a
          statement about nothing. */}
      {total > 0 ? (
        <Text className="text-sm">
          {owing > 0.004
            ? `${formatMoney(owing, currency)} of ${formatMoney(total, currency)} will still be owed.`
            : owing < -0.004
              ? `That is ${formatMoney(-owing, currency)} more than the sale comes to.`
              : `Paid in full: ${formatMoney(total, currency)}.`}
        </Text>
      ) : null}
    </FormSection>
  );
}
