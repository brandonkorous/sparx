'use client';

import { type ReactNode, useState } from 'react';
import { Checkbox, Field, FieldControl, FieldLabel, Input } from '@wizeworks/silicaui-react';
import {
  type Bill,
  BILL_ROWS,
  type BillRow,
  type Bills,
  EMPTY_BILLS,
  figures,
} from './what-you-pay-rows';
import { WhatYouPayReceipt } from './what-you-pay-receipt';

// The only client boundary on /pricing. Everything else on the page is a server
// component and stays one.
//
// ── THE AMOUNT FIELD IS NOT INSIDE THE LABEL ────────────────────────────────
//
// two-questions.tsx makes the whole row a <label> so the text is a hit target,
// and that is right there because the row holds nothing but text. A text input
// inside a label bound to a checkbox means every click into the box toggles the
// tick, so here the label wraps the tick and its words only, and the input is
// its sibling.
//
// ── <FieldControl>, NOT A BARE <Input> INSIDE A <Field> ─────────────────────
//
// Base UI's Field mints an id, puts it in the label's `for`, and hands it to
// Field.Control. A silica control dropped in as a plain child never receives it,
// so the label points at nothing: the input has no accessible name and clicking
// the label does nothing. It renders identically either way, which is why it
// survives review — measured on this page before the fix, and the whole tools
// suite has the same fault (ui-kit.tsx, ~200 controls). Styling goes on the
// rendered Input; everything else on FieldControl.
//
// The amount fields in <BillField> are NOT in a Field and carry their own
// `aria-label`, which is correct — their visible label is the row's own text.
//
// ── TWO FACTS PER ROW, ON PURPOSE ───────────────────────────────────────────
//
// Ticked, and how much. Somebody who knows they pay for a website but would have
// to go and look up what it costs still has a bill and a renewal date, and the
// panel can make its argument from the count alone. Requiring a number to
// register a subscription would lose that person entirely.

const CONTROL = 'lg' as const;

/** `success` — DESIGN.md's assignment table: the price, the bill, money going in
 *  or out. `primary` stays on the one signup action, as it does everywhere on
 *  this site. */
const COLOR = 'success' as const;

function BillField({
  row,
  bill,
  onToggle,
  onAmount,
}: {
  row: BillRow;
  bill: Bill;
  onToggle: () => void;
  onAmount: (value: string) => void;
}) {
  return (
    <li
      className={`rounded-box grid grid-cols-[1fr_auto] items-center gap-3 border p-4 transition-colors ${
        bill.on ? 'border-success bg-success bg-soft' : 'border-base-300'
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox color={COLOR} checked={bill.on} onChange={onToggle} className="mt-0.5" />
        <span>
          <span className="block text-lg font-bold">{row.label}</span>
          {row.like ? <span className="block text-base">{row.like}</span> : null}
        </span>
      </label>

      {bill.on ? (
        <Input
          color={COLOR}
          size={CONTROL}
          className="w-28 text-right tabular-nums"
          inputMode="decimal"
          placeholder="$0"
          aria-label={`${row.label} — what it costs you a month`}
          value={bill.amount}
          onChange={(e) => onAmount(e.target.value)}
        />
      ) : null}
    </li>
  );
}

export function WhatYouPayForm({ blank }: { blank: ReactNode }) {
  const [bills, setBills] = useState<Bills>(EMPTY_BILLS);
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('');

  const f = figures(bills, hours, rate);

  const set = (id: BillRow['id'], next: Partial<Bill>) =>
    setBills((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));

  return (
    <div className="mt-10 grid gap-3.5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-7">
        <div>
          <p className="text-xl font-black">What are you paying for today?</p>
          <p className="mt-1 text-base">
            Tick the ones you have. Put the monthly cost beside them if you know it.
          </p>

          <ul className="mt-4 grid gap-2.5">
            {BILL_ROWS.map((row) => (
              <BillField
                key={row.id}
                row={row}
                bill={bills[row.id]}
                onToggle={() => set(row.id, { on: !bills[row.id].on })}
                onAmount={(amount) => set(row.id, { amount })}
              />
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xl font-black">And your own time?</p>
          <p className="mt-1 text-base">
            The hours that go on moving the same information from one of them into another. Leave
            these empty if you would rather not think about it.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel className="text-base font-semibold">Hours a week</FieldLabel>
              <FieldControl
                render={<Input color={COLOR} size={CONTROL} />}
                inputMode="decimal"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel className="text-base font-semibold">
                What an hour of yours is worth
              </FieldLabel>
              <FieldControl
                render={<Input color={COLOR} size={CONTROL} />}
                inputMode="decimal"
                placeholder="$0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Sticky on a wide screen: the form is twelve fields long and the
                whole point is watching the answer move as you fill it in.

                Form FIRST on a phone, unlike the tool pages. Those arrive with a
                result already computed, so the answer is what you came for; this
                one starts empty, and leading with a blank panel would put the
                answer above the fields that produce it. */}
      <div className="flex flex-col lg:sticky lg:top-24">
        {f.bills === 0 ? blank : <WhatYouPayReceipt bills={bills} f={f} />}
      </div>
    </div>
  );
}
