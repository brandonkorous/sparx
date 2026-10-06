'use client';

// How a markup rule works a price out from a cost, and what a $100 cost comes to
// under it (sparx persona issue 086): a rule is checked by its effect.

import { Field, FieldControl, FieldLabel, Select, Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { formatCentsAmount } from '../../lib/money-format';
import type { BandMethodName, RuleMethod } from './markup-rule-words';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';
import { examplePrice, type DraftErrors } from './markup-rule-checks';
import { MarkupRuleBands } from './markup-rule-bands';
import { UnitField } from './markup-rule-fields';

const METHODS: { value: RuleMethod; label: string }[] = [
  { value: 'percentage', label: 'Add a percentage to the cost' },
  { value: 'multiplier', label: 'Multiply the cost' },
  { value: 'flat', label: 'Add a set amount to the cost' },
  { value: 'margin_target', label: 'Aim for a margin' },
  { value: 'matrix', label: 'A different markup for each cost range' },
];

const VALUE_WORDS: Record<BandMethodName, { label: string; unit: string; help: string }> = {
  percentage: {
    label: 'Percent to add',
    unit: '%',
    help: '40 means something that cost you $100 sells for $140.',
  },
  multiplier: {
    label: 'Multiply by',
    unit: '×',
    help: '2 means something that cost you $100 sells for $200.',
  },
  flat: { label: 'Amount to add', unit: '$', help: 'Added to every item, whatever it cost.' },
  margin_target: {
    label: 'Margin to aim for',
    unit: '%',
    help: 'Margin is your profit as a share of the price you charge.',
  },
};

function Example({ draft }: { draft: RuleDraft }) {
  const example = examplePrice(draft);
  if (!example) {
    return <Text className="text-sm">Fill in the markup to see what it charges.</Text>;
  }
  const money = (cents: number) => formatCentsAmount(cents, 'USD');
  return (
    <Text role="status">
      Something that cost you <strong>{money(example.costCents)}</strong> sells for{' '}
      <strong>{money(example.priceCents)}</strong>, a {String(example.marginPct)}% margin.
    </Text>
  );
}

function ValueField({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  const words = VALUE_WORDS[draft.method as BandMethodName];
  return (
    <UnitField
      label={words.label}
      unit={words.unit}
      value={draft.value}
      error={error}
      help={words.help}
      onChange={(next) => {
        set('value', next);
      }}
    />
  );
}

export function MarkupRulePrice({
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
  const pickMethod = (next: unknown) => {
    if (!next) return;
    set('method', next as RuleMethod);
    if (next === 'matrix' && draft.bands.length === 0) {
      set('bands', [{ from: '0', to: '', method: 'percentage', value: draft.value }]);
    }
  };
  return (
    <FormSection
      title="How the price is worked out"
      description="Every price starts from what the item cost you."
    >
      <Field>
        <FieldLabel>Markup</FieldLabel>
        <FieldControl
          render={
            <div className="max-w-sm">
              <Select
                color="module"
                aria-label="How this rule marks up"
                value={draft.method}
                items={METHODS}
                onValueChange={pickMethod}
              />
            </div>
          }
        />
      </Field>
      {draft.method === 'matrix' ? (
        <MarkupRuleBands draft={draft} set={set} error={showErrors ? errors.bands : null} />
      ) : (
        <ValueField draft={draft} set={set} error={showErrors ? errors.value : null} />
      )}
      <Example draft={draft} />
    </FormSection>
  );
}
