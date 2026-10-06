'use client';

// The running summary — the number the operator is actually building toward.
//
// In the old stacked form the total sat at the very bottom, below every line,
// so you had to scroll past the work to see what you were about to bill. Here
// it lives in the rail and PINS while the lines scroll, so the figure being
// checked never leaves the screen. It also owns the tax rate, because that is
// the one input whose whole job is to change the number right beside it.
//
// Everything recomputes locally as you type. `saved` is the server's last
// settled word on the same document; when it disagrees with the live total
// there are unsaved edits, and saying so plainly beats showing one figure and
// leaving the operator to guess which is real. Money is never faded — a total
// someone is about to charge a customer is the opposite of de-emphasised.

import { useEffect, useState } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { EDITOR_RAIL_STICKY } from '../../components/editor-layout';
import { computeTotals, type DraftLine } from './totals';
import { formatMoney } from './types';
import { parsePercent, percentText } from './tax-rate';
import { MarginSummary } from './margin-summary';

interface SavedFigures {
  total: number;
  balance: number;
  amountPaid: number;
}

interface InvoiceSummaryProps {
  lines: DraftLine[];
  taxRate: number;
  currency: string;
  readOnly?: boolean;
  onTaxRateChange: (rate: number) => void;
  /** Document-level charges that are not lines and are not taxed: the delivery
   *  charge and any surcharge, carried across from the order. They are part of
   *  what the customer is asked for, so they belong in this block -- leaving
   *  them out made Total disagree with Amount due right beside it. */
  shippingTotal?: number;
  surchargeTotal?: number;
  /** The server's settled figures, once the document has been saved at least once. */
  saved?: SavedFigures;
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success';
}) {
  const valueTone = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : '';
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Text as="span" className={strong ? 'font-medium' : 'text-sm'}>
        {label}
      </Text>
      <Text
        as="span"
        className={`tabular-nums ${strong ? 'text-lg font-semibold' : ''} ${valueTone}`}
      >
        {value}
      </Text>
    </div>
  );
}

/**
 * The tax rate, typed as the percentage an owner knows it by ("8.75") and stored
 * as the fraction the document holds (issue 077). The box keeps its own TEXT, so
 * it can be cleared and retyped, and "8." can be on its way to "8.75", without
 * the stored number snapping back into it mid-keystroke.
 */
function TaxRateField({
  taxRate,
  readOnly,
  onTaxRateChange,
}: {
  taxRate: number;
  readOnly: boolean | undefined;
  onTaxRateChange: (rate: number) => void;
}) {
  const [text, setText] = useState(() => percentText(taxRate));
  // Follow a rate set from elsewhere (the document loading), never the one this
  // box just sent: that would rewrite what is being typed.
  useEffect(() => {
    if (parsePercent(text) !== taxRate) setText(percentText(taxRate));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `text` is read to compare, not followed: following it would undo every keystroke that is not yet a whole rate.
  }, [taxRate]);
  const parsed = parsePercent(text);
  return (
    <Field>
      <FieldLabel>Tax rate (%)</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            type="text"
            inputMode="decimal"
            value={text}
            disabled={readOnly}
            className="text-right tabular-nums"
            onChange={(event) => {
              setText(event.target.value);
              const rate = parsePercent(event.target.value);
              if (rate !== null) onTaxRateChange(rate);
            }}
          />
        }
      />
      {parsed === null ? (
        <FieldStatus status="error">Type the rate as a number up to 100, like 8.75.</FieldStatus>
      ) : (
        <FieldDescription>
          The percentage you charge, the way you would say it: type 8.75 for 8.75%. Leave it at 0 if
          you do not charge tax.
        </FieldDescription>
      )}
    </Field>
  );
}

export function InvoiceSummary({
  lines,
  taxRate,
  currency,
  readOnly,
  onTaxRateChange,
  shippingTotal = 0,
  surchargeTotal = 0,
  saved,
}: InvoiceSummaryProps) {
  const totals = computeTotals(lines, taxRate, shippingTotal, surchargeTotal);
  const taxPct = (taxRate * 100).toFixed(2).replace(/\.?0+$/, '');
  const differs = saved !== undefined && Math.abs(saved.total - totals.total) >= 0.01;

  return (
    <section
      aria-label="Summary"
      className={`card bg-base-100 flex flex-col gap-4 p-4 ${EDITOR_RAIL_STICKY}`}
    >
      <Heading level={2} className="text-lg font-semibold">
        Summary
      </Heading>

      <TaxRateField taxRate={taxRate} readOnly={readOnly} onTaxRateChange={onTaxRateChange} />

      <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
        <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
        {totals.discountTotal > 0 ? (
          <Row label="Discount" value={`−${formatMoney(totals.discountTotal, currency)}`} />
        ) : null}
        <Row
          label={taxRate > 0 ? `Tax (${taxPct}%)` : 'Tax'}
          value={formatMoney(totals.taxTotal, currency)}
        />
        {/* Each charge only when there is one, as on the printed invoice: a
            "Delivery $0.00" row is a number nobody set, but a charge that IS on
            the bill must be visible beside the total it changes. */}
        {totals.shippingTotal > 0 ? (
          <Row label="Delivery" value={formatMoney(totals.shippingTotal, currency)} />
        ) : null}
        {totals.surchargeTotal > 0 ? (
          <Row label="Surcharge" value={formatMoney(totals.surchargeTotal, currency)} />
        ) : null}
        {totals.coreChargeTotal > 0 ? (
          <Row
            label="Refundable core deposits"
            value={formatMoney(totals.coreChargeTotal, currency)}
          />
        ) : null}
        <div className="border-base-300 mt-1 border-t pt-2">
          <Row label="Total" value={formatMoney(totals.total, currency)} strong />
        </div>
      </div>

      {/* What it makes, under what it charges (issue 086). Staff only. */}
      <MarginSummary lines={lines} currency={currency} />

      {differs ? (
        <Text className="text-warning text-sm">
          Not saved yet: {formatMoney(saved.total, currency)} is what the customer would see today.
        </Text>
      ) : null}

      {/* Once saved, the money that has actually moved. Amount due is the figure
          an owner opens this document to check, so it carries the strong weight
          and a tone: red while owed, green when settled. */}
      {saved && (saved.amountPaid > 0 || saved.balance !== saved.total) ? (
        <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
          <Row label="Paid" value={formatMoney(saved.amountPaid, currency)} />
          <Row
            label="Amount due"
            value={formatMoney(saved.balance, currency)}
            strong
            tone={saved.balance > 0 ? 'danger' : 'success'}
          />
        </div>
      ) : null}
    </section>
  );
}
