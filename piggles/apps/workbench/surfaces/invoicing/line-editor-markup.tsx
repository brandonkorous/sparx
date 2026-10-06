'use client';

// HOW a marked-up line's price is worked out: the markup directive and its terms
// on one line, with the price it produces directly beneath.

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { ADHOC, METHOD_META, PASSTHROUGH, type MarkupRuleSummary } from './line-markup';
import { formatMoney } from './types';
import type { useLineForm } from './use-line-form';
import type { BandMethod } from '@wizeworks/commerce-schemas';

type Form = ReturnType<typeof useLineForm>;

function MarkupSourceField({
  form,
  markupRules,
  onManageMarkupRules,
}: {
  form: Form;
  markupRules: MarkupRuleSummary[];
  onManageMarkupRules?: (() => void) | undefined;
}) {
  return (
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
      {onManageMarkupRules ? (
        <ManageRules count={markupRules.length} onOpen={onManageMarkupRules} />
      ) : null}
    </Field>
  );
}

/** Rules could only be made through the API, so the list offered rules no
 *  screen could make (sparx persona issue 086). */
function ManageRules({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {count === 0 ? (
        <Text as="span" className="text-sm">
          No saved rules yet.
        </Text>
      ) : null}
      <Button variant="link" color="module" size="sm" className="px-0" onClick={onOpen}>
        {count === 0 ? 'Add a markup rule' : 'Manage markup rules'}
      </Button>
    </div>
  );
}

function AdhocFields({ form }: { form: Form }) {
  return (
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
            // Text, read like money: a number field read "8,50" as nothing (086).
            <Input
              color="module"
              type="text"
              inputMode="decimal"
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
  );
}

/** The price the markup produces, under the same name as the manual field.
 *  The margin is the badge below it, shared with every line (issue 086). */
function MarkupPreview({ form, currency }: { form: Form; currency: string }) {
  const preview = form.resolved.preview;
  if (!preview) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <Text as="span" className="text-sm">
        Price each
      </Text>
      <Text as="span" className="text-lg font-semibold tabular-nums">
        {formatMoney(preview.priceCents / 100, currency)}
      </Text>
      <Text as="span" className="text-sm tabular-nums">
        {preview.markupPct}% markup on cost
      </Text>
    </div>
  );
}

export function LineEditorMarkup({
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-3">
        <MarkupSourceField
          form={form}
          markupRules={markupRules}
          onManageMarkupRules={onManageMarkupRules}
        />
        {form.markup.source === ADHOC ? <AdhocFields form={form} /> : null}
      </div>
      <MarkupPreview form={form} currency={currency} />
    </div>
  );
}
