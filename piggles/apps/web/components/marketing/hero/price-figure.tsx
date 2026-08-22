import { Badge } from '@wizeworks/silicaui-react';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { HeroPanel, HeroRow, HeroRows } from './panel';

// /pricing — the bill.
//
// The page named a price in its heading and then put a receipt eight hundred
// pixels below it, so the one thing a visitor came for arrived as a sentence and
// the proof arrived after a scroll. This is the proof, at the top: every line
// somebody expects to be charged for, each one reading "included", and then the
// only number on the page.
//
// ── IT IS NOT THE CALCULATOR ────────────────────────────────────────────────
//
// <WhatYouPay> further down is a six-field estimate of what a visitor pays TODAY
// across ten other bills, and it stays where it is — an interactive comparison
// is a minute of somebody's attention, which is not what a fold is for. This is
// the opposite shape: no input, no arithmetic, four seconds.
//
// ── EVERY LINE IS A REAL ALLOWANCE ──────────────────────────────────────────
//
// Taken from the same source as the table on this page and stated the same way,
// because a hero that rounds "3 people" up to "your team" is the sort of small
// dishonesty a pricing page cannot afford. The four chosen are the ones other
// software bills separately — apps, seats, a domain, a sending address — so the
// receipt answers the objection rather than listing the product.

const LINES: { what: string; note: string }[] = [
  { what: 'All fifteen apps', note: 'No app is an upgrade' },
  { what: 'Your own domain', note: 'Certificate included' },
  { what: 'Your own sending address', note: 'Email from your business, not ours' },
  { what: 'Three people on your team', note: 'Each with their own sign-in' },
];

export function PriceFigure() {
  return (
    <HeroPanel>
      <div className="border-base-300 border-b px-5 py-3.5">
        <b className="text-base font-bold">What you would be billed for elsewhere</b>
      </div>

      <HeroRows>
        {LINES.map((line) => (
          <HeroRow
            key={line.what}
            label={line.what}
            sub={line.note}
            right={
              <Badge color="success" variant="soft" size="lg">
                Included
              </Badge>
            }
          />
        ))}
      </HeroRows>

      {/* The total is the loudest thing in the figure and the only numeral in
          it. `bg-primary` rather than a plain row: the brand fill is what makes
          the bottom of the receipt read as the answer instead of a fifth line
          item, and it is the one place on this page the pink is a surface. */}
      <div className="bg-primary text-primary-content flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-5">
        <span className="text-lg font-bold">Everything, every month</span>
        <span className="text-5xl leading-none font-black tabular-nums">
          {PRICE_LABEL}
          <span className="text-xl font-bold">/mo</span>
        </span>
      </div>

      <p className="px-5 py-4 text-base font-semibold">
        The number only moves when your business needs more room — never when you open another app.
      </p>
    </HeroPanel>
  );
}
