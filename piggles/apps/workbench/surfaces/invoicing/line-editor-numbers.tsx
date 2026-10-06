'use client';

// The money on a line: how many, what it costs you, what they pay, the core
// deposit, and the markup row that can work the price out for you.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
} from '@wizeworks/silicaui-react';
import { MoneyInput } from '../../components/money-input';
import type { MarkupRuleSummary } from './line-markup';
import type { useLineForm } from './use-line-form';
import { LineEditorMarkup } from './line-editor-markup';

type Form = ReturnType<typeof useLineForm>;

function QuantityField({ form }: { form: Form }) {
  return (
    <Field className="w-28">
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
  );
}

/** Two money boxes side by side and only one bills anybody, so both say which:
 *  a charge typed into "Cost" made a $0.00 invoice with the figure nowhere. */
function PriceField({ form }: { form: Form }) {
  return (
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
  );
}

/** Cost lives here in EVERY mode: it belongs to the line, not to the markup. */
function CostField({ form }: { form: Form }) {
  return (
    <Field className="w-36">
      <FieldLabel required={form.markupMode}>Cost to you</FieldLabel>
      {/* Money that can be blank: "8,50" read as no cost, and an empty box
          showed "0.00" as if measured (sparx persona issue 086). */}
      <MoneyInput
        optional
        size="md"
        color="module"
        value={form.costValue}
        aria-label="Cost to you"
        onValueChange={form.setCostValue}
      />
      <FieldDescription>{form.costHelp}</FieldDescription>
      {form.show(form.errors.cost) ? (
        <FieldStatus status="error">{form.errors.cost}</FieldStatus>
      ) : null}
    </Field>
  );
}

/** The discount, and a rebuilt part's refundable core deposit per unit (sparx
 *  issue 051): never taxed or discounted, paid back when the old part returns. */
function AdjustmentFields({ form }: { form: Form }) {
  return (
    <>
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
      <Field className="w-32">
        <FieldLabel>Core deposit</FieldLabel>
        <MoneyInput
          size="md"
          color="module"
          value={form.coreCharge ?? 0}
          aria-label="Core deposit per unit"
          onValueChange={form.setCoreCharge}
        />
      </Field>
    </>
  );
}

export function LineEditorNumbers({
  form,
  markupRules,
  currency,
  onManageMarkupRules,
}: {
  form: Form;
  markupRules: MarkupRuleSummary[];
  currency: string;
  onManageMarkupRules?: (() => void) | undefined;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <QuantityField form={form} />
        {form.markupMode ? null : <PriceField form={form} />}
        <CostField form={form} />
        <AdjustmentFields form={form} />
      </div>
      {form.markupMode ? (
        <LineEditorMarkup
          form={form}
          markupRules={markupRules}
          currency={currency}
          onManageMarkupRules={onManageMarkupRules}
        />
      ) : null}
    </>
  );
}
