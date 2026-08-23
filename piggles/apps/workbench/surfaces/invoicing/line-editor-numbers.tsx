'use client';

// The money on a line: how many, what it costs you, what they pay, and the
// markup row that can work the last one out for you.
//
// Split out of the modal so each file holds one job (piggles RULE #0.5).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { MoneyInput, MoneyTextInput } from '../../components/money-input';
import { ADHOC, METHOD_META, PASSTHROUGH, type MarkupRuleSummary } from './line-markup';
import { formatMoney } from './types';
import type { useLineForm } from './use-line-form';
import type { BandMethod } from '@wizeworks/commerce-schemas';

export function LineEditorNumbers({
  form,
  markupRules,
  currency,
}: {
  form: ReturnType<typeof useLineForm>;
  markupRules: MarkupRuleSummary[];
  currency: string;
}) {
  return (
    <>
      {/* Cost lives here in EVERY mode — it belongs to the line, not to the
          markup. Only the price moves: typed here, or worked out below. */}
      <div className="flex flex-wrap items-start gap-3">
        <Field className="w-20">
          <FieldLabel required>Qty</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="number"
                min="0"
                step="0.001"
                className="text-right tabular-nums"
                value={form.quantity}
                onChange={(e) => {
                  form.setQuantity(e.target.value);
                }}
              />
            }
          />
          {form.show(form.errors.quantity) ? (
            <FieldStatus status="error">{form.errors.quantity}</FieldStatus>
          ) : null}
        </Field>

        {/* Two money boxes side by side, and only one of them bills anybody.
            Both say which, because the invoice shows the price and silently
            drops the cost — so putting the charge in the wrong box produced a
            $0.00 invoice with the typed figure nowhere on screen. */}
        {form.markupMode ? null : (
          <Field className="w-36">
            <FieldLabel>Price each</FieldLabel>
            <MoneyInput
              size="md"
              color="module"
              value={form.unitPrice}
              aria-label="Price each"
              onValueChange={form.setUnitPrice}
            />
            <FieldDescription>What they are charged.</FieldDescription>
            {form.show(form.errors.unitPrice) ? (
              <FieldStatus status="error">{form.errors.unitPrice}</FieldStatus>
            ) : null}
          </Field>
        )}

        <Field className="w-36">
          <FieldLabel required={form.markupMode}>Cost to you</FieldLabel>
          <FieldControl
            render={
              <MoneyTextInput
                color="module"
                className="text-right"
                aria-label="Cost to you"
                text={form.cost}
                onTextChange={form.setCost}
              />
            }
          />
          <FieldDescription>
            {form.markupMode
              ? 'What it cost you. The price is worked out from this.'
              : 'Optional, and never shown to them. It is how you see your margin.'}
          </FieldDescription>
          {form.show(form.errors.cost) ? (
            <FieldStatus status="error">{form.errors.cost}</FieldStatus>
          ) : null}
        </Field>

        <Field className="w-28">
          <FieldLabel>Discount</FieldLabel>
          <MoneyInput
            size="md"
            color="module"
            value={form.discountAmount}
            aria-label="Line discount"
            onValueChange={form.setDiscountAmount}
          />
        </Field>
      </div>

      {/* HOW the price is worked out — the markup directive and its terms,
          on one line, with the price it produces directly beneath. */}
      {form.markupMode ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-3">
            <Field className="min-w-[11rem] flex-1">
              <FieldLabel>Markup</FieldLabel>
              <NativeSelect
                color="module"
                aria-label="Markup source"
                value={form.markup.source}
                onChange={(e) => {
                  form.setMarkup((s) => ({ ...s, source: e.target.value }));
                }}
              >
                {form.pricingMode === 'pass_through' ? (
                  <option value={PASSTHROUGH}>Pass through at cost</option>
                ) : null}
                {markupRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                <option value={ADHOC}>Ad-hoc markup…</option>
              </NativeSelect>
            </Field>

            {form.markup.source === ADHOC ? (
              <>
                <Field className="w-40">
                  <FieldLabel>Method</FieldLabel>
                  <NativeSelect
                    color="module"
                    aria-label="Markup method"
                    value={form.markup.method}
                    onChange={(e) => {
                      form.setMarkup((s) => ({ ...s, method: e.target.value as BandMethod }));
                    }}
                  >
                    <option value="percentage">Markup %</option>
                    <option value="margin_target">Target margin %</option>
                    <option value="multiplier">Multiplier ×</option>
                    <option value="flat">Add fixed $</option>
                  </NativeSelect>
                </Field>
                <Field className="w-24">
                  <FieldLabel>{METHOD_META[form.markup.method].label}</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        type="number"
                        step="0.01"
                        className="text-right tabular-nums"
                        value={form.markup.value}
                        onChange={(e) => {
                          form.setMarkup((s) => ({ ...s, value: e.target.value }));
                        }}
                      />
                    }
                  />
                  {form.show(form.errors.markup) ? (
                    <FieldStatus status="error">{form.errors.markup}</FieldStatus>
                  ) : null}
                </Field>
              </>
            ) : null}
          </div>

          {/* The price the markup produces. Same words as the row and the manual
              field — one number, one name. Never faded; this is what is charged. */}
          {form.resolved.preview ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Text as="span" className="text-sm">
                Price each
              </Text>
              <Text as="span" className="text-lg font-semibold tabular-nums">
                {formatMoney(form.resolved.preview.priceCents / 100, currency)}
              </Text>
              <Text as="span" className="text-sm tabular-nums">
                {form.resolved.preview.marginPct}% margin · {form.resolved.preview.markupPct}%
                markup
              </Text>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
