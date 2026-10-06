'use client';

// The optional limits on a markup rule: rounding, a least profit or margin, and
// a most it may charge (sparx persona issue 086). Left alone, the price is
// exactly what the markup works out, which is what most rules want.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import type { DraftErrors, RoundingChoice, RuleDraft, SetRuleDraft } from './markup-rule-words';

const ROUNDING: { value: RoundingChoice; label: string }[] = [
  { value: 'none', label: 'Leave the cents as they work out' },
  { value: 'nearest', label: 'Round to the nearest…' },
  { value: 'charm', label: 'Make every price end in…' },
];

const NEAREST = [5, 10, 25, 50, 100];
const ENDINGS = [99, 95, 49, 0];

/** The choices, plus one a rule already holds that is not among them, so a
 *  rule made elsewhere is shown as it is rather than as the first option. */
function withCurrent(list: number[], current: number): number[] {
  return list.includes(current) ? list : [...list, current].sort((a, b) => a - b);
}

function cents(n: number): string {
  return `$${(n / 100).toFixed(2)}`;
}

function DollarField({
  label,
  value,
  error,
  help,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  help: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <div className="flex max-w-40 items-center gap-1">
            <Text as="span" className="text-sm">
              $
            </Text>
            <Input
              color={error ? 'error' : 'module'}
              inputMode="decimal"
              className="text-right tabular-nums"
              aria-label={label}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
              }}
            />
          </div>
        }
      />
      {error ? (
        <FieldStatus status="error">{error}</FieldStatus>
      ) : (
        <FieldDescription>{help}</FieldDescription>
      )}
    </Field>
  );
}

function RoundingFields({ draft, set }: { draft: RuleDraft; set: SetRuleDraft }) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>Rounding</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="How prices are rounded"
              value={draft.rounding}
              items={ROUNDING}
              onValueChange={(next) => {
                set('rounding', (next as RoundingChoice | null) ?? 'none');
              }}
            />
          }
        />
      </Field>
      {draft.rounding === 'nearest' ? (
        <Field>
          <FieldLabel>Nearest</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                aria-label="Round to the nearest"
                value={String(draft.precisionCents)}
                items={withCurrent(NEAREST, draft.precisionCents).map((n) => ({
                  value: String(n),
                  label: cents(n),
                }))}
                onValueChange={(next) => {
                  if (next) set('precisionCents', Number(next));
                }}
              />
            }
          />
        </Field>
      ) : null}
      {draft.rounding === 'charm' ? (
        <Field>
          <FieldLabel>Ending</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                aria-label="Every price ends in"
                value={String(draft.endingCents)}
                items={withCurrent(ENDINGS, draft.endingCents).map((n) => ({
                  value: String(n),
                  label: `.${String(n).padStart(2, '0')}`,
                }))}
                onValueChange={(next) => {
                  if (next) set('endingCents', Number(next));
                }}
              />
            }
          />
          <FieldDescription>Prices round up to the next one that ends this way.</FieldDescription>
        </Field>
      ) : null}
    </div>
  );
}

function CeilingFields({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  const items = [
    { value: 'none', label: 'No upper limit' },
    { value: 'compare_at', label: "The product's compare-at price" },
    // Only offered when a rule already uses it: nothing on this screen sets a
    // maker's suggested price, so choosing it here would cap nothing.
    ...(draft.ceilingSrc === 'msrp'
      ? [{ value: 'msrp', label: "The maker's suggested price" }]
      : []),
    { value: 'fixed', label: 'A set amount' },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>Never charge more than</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="Never charge more than"
              value={draft.ceilingSrc}
              items={items}
              onValueChange={(next) => {
                set('ceilingSrc', (next as string | null) ?? 'none');
              }}
            />
          }
        />
      </Field>
      {draft.ceilingSrc === 'fixed' ? (
        <DollarField
          label="Most it may charge"
          value={draft.ceilingValue}
          error={error}
          help="Per item."
          onChange={(next) => {
            set('ceilingValue', next);
          }}
        />
      ) : null}
    </div>
  );
}

export function MarkupRuleLimits({
  draft,
  set,
  errors,
  showErrors,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  errors: DraftErrors;
  showErrors: boolean;
}) {
  return (
    <FormSection
      title="Rounding and limits"
      description="Optional. Left alone, the price is exactly what the markup works out."
    >
      <RoundingFields draft={draft} set={set} />

      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <DollarField
          label="Always make at least"
          value={draft.floorProfit}
          error={showErrors ? errors.floorProfit : null}
          help="Profit per item. Leave it blank for no minimum."
          onChange={(next) => {
            set('floorProfit', next);
          }}
        />
        <Field>
          <FieldLabel>Never less than this margin</FieldLabel>
          <FieldControl
            render={
              <div className="flex max-w-40 items-center gap-1">
                <Input
                  color={showErrors && errors.floorMargin ? 'error' : 'module'}
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label="Never less than this margin, in percent"
                  value={draft.floorMargin}
                  onChange={(event) => {
                    set('floorMargin', event.target.value);
                  }}
                />
                <Text as="span" className="text-sm">
                  %
                </Text>
              </div>
            }
          />
          {showErrors && errors.floorMargin ? (
            <FieldStatus status="error">{errors.floorMargin}</FieldStatus>
          ) : (
            <FieldDescription>Leave it blank for no minimum.</FieldDescription>
          )}
        </Field>
      </div>

      <CeilingFields draft={draft} set={set} error={showErrors ? errors.ceilingValue : null} />
    </FormSection>
  );
}
