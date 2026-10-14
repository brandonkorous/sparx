'use client';

// The sum of a sale at the counter: the goods, any refundable core deposits and
// the sales tax each on a row of their own, as the website's checkout summary
// lays them out, so the till and the receipt add up the same way. The tax row
// was missing, and so was the tax (sparx persona issue 230).

import { formatMoney } from './data';
import { CORE_DEPOSITS_ROW, type SaleTotals } from './sale-core';

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={strong ? 'flex justify-between gap-3 font-semibold' : 'flex justify-between gap-3'}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function SaleTotalsRows({
  totals,
  currency,
  taxLabel,
  taxKnown,
}: {
  totals: SaleTotals;
  currency: string;
  taxLabel: string;
  taxKnown: boolean;
}) {
  return (
    <dl className="border-base-300 flex flex-col gap-1 border-t pt-3">
      <Row label="Subtotal" value={formatMoney(totals.goods, currency)} />
      {totals.coreDeposits > 0 ? (
        <Row label={CORE_DEPOSITS_ROW} value={formatMoney(totals.coreDeposits, currency)} />
      ) : null}
      <Row
        label={taxLabel}
        value={taxKnown ? formatMoney(totals.tax, currency) : 'Working it out…'}
      />
      <Row label="Total" value={formatMoney(totals.total, currency)} strong />
    </dl>
  );
}
