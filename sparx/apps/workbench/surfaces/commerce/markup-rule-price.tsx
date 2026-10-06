'use client';

// How a markup rule works a price out from a cost, and what that comes to on a
// round $100 (sparx persona issue 086). The example is the point: an owner
// checks a rule by its effect, not by reading its settings back.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { Plus, Trash2 } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { formatCentsAmount } from '../../lib/money-format';
import {
  examplePrice,
  type BandDraft,
  type BandMethodName,
  type DraftErrors,
  type RuleDraft,
  type RuleMethod,
  type SetRuleDraft,
} from './markup-rule-words';

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

/** Short labels for a cost range's own method, where a row has little room. */
const BAND_METHODS: { value: BandMethodName; label: string }[] = [
  { value: 'percentage', label: '% added' },
  { value: 'multiplier', label: '× cost' },
  { value: 'flat', label: '$ added' },
  { value: 'margin_target', label: '% margin' },
];

function money(cents: number): string {
  return formatCentsAmount(cents, 'USD');
}

function Example({ draft }: { draft: RuleDraft }) {
  const example = examplePrice(draft);
  if (!example) {
    return <Text className="text-sm">Fill in the markup to see what it charges.</Text>;
  }
  return (
    <Text role="status">
      Something that cost you <strong>{money(example.costCents)}</strong> sells for{' '}
      <strong>{money(example.priceCents)}</strong>, a {String(example.marginPct)}% margin.
    </Text>
  );
}

function BandRow({
  band,
  index,
  onChange,
  onRemove,
}: {
  band: BandDraft;
  index: number;
  onChange: (next: BandDraft) => void;
  onRemove: () => void;
}) {
  const which = `Range ${String(index + 1)}`;
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Text as="span" className="w-20 shrink-0 text-sm font-medium">
        {which}
      </Text>
      <Input
        size="sm"
        color="module"
        inputMode="decimal"
        className="w-24 text-right tabular-nums"
        aria-label={`${which} starts at a cost of`}
        placeholder="From $"
        value={band.from}
        onChange={(event) => {
          onChange({ ...band, from: event.target.value });
        }}
      />
      <Input
        size="sm"
        color="module"
        inputMode="decimal"
        className="w-24 text-right tabular-nums"
        aria-label={`${which} ends at a cost of (blank for no top)`}
        placeholder="and up"
        value={band.to}
        onChange={(event) => {
          onChange({ ...band, to: event.target.value });
        }}
      />
      <NativeSelect
        size="sm"
        color="module"
        className="w-28"
        aria-label={`${which} markup`}
        value={band.method}
        onChange={(event) => {
          onChange({ ...band, method: event.target.value as BandMethodName });
        }}
      >
        {BAND_METHODS.map((method) => (
          <option key={method.value} value={method.value}>
            {method.label}
          </option>
        ))}
      </NativeSelect>
      <Input
        size="sm"
        color="module"
        inputMode="decimal"
        className="w-20 text-right tabular-nums"
        aria-label={`${which} amount`}
        value={band.value}
        onChange={(event) => {
          onChange({ ...band, value: event.target.value });
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        aria-label={`Remove ${which}`}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

function Bands({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  const replace = (index: number, next: BandDraft) => {
    set(
      'bands',
      draft.bands.map((band, i) => (i === index ? next : band))
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <Text className="text-sm">
        Costs from the first amount up to the second. The cheapest items usually carry the biggest
        markup.
      </Text>
      {draft.bands.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {draft.bands.map((band, index) => (
            <BandRow
              // Rows have no identity of their own and are only added at the end
              // or removed, so the position is stable enough for a key.
              key={index}
              band={band}
              index={index}
              onChange={(next) => {
                replace(index, next);
              }}
              onRemove={() => {
                set(
                  'bands',
                  draft.bands.filter((_, i) => i !== index)
                );
              }}
            />
          ))}
        </ul>
      ) : null}
      {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
      <div>
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            const last = draft.bands.at(-1);
            set('bands', [
              ...draft.bands,
              { from: last?.to ?? '0', to: '', method: 'percentage', value: '' },
            ]);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a cost range
        </Button>
      </div>
    </div>
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
  const words = draft.method === 'matrix' ? null : VALUE_WORDS[draft.method];
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
                onValueChange={(next) => {
                  if (!next) return;
                  set('method', next as RuleMethod);
                  if (next === 'matrix' && draft.bands.length === 0) {
                    set('bands', [{ from: '0', to: '', method: 'percentage', value: draft.value }]);
                  }
                }}
              />
            </div>
          }
        />
      </Field>

      {words ? (
        <Field>
          <FieldLabel>{words.label}</FieldLabel>
          <FieldControl
            render={
              <div className="flex max-w-40 items-center gap-1">
                {words.unit === '$' ? (
                  <Text as="span" className="text-sm">
                    $
                  </Text>
                ) : null}
                <Input
                  color={showErrors && errors.value ? 'error' : 'module'}
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={words.label}
                  value={draft.value}
                  onChange={(event) => {
                    set('value', event.target.value);
                  }}
                />
                {words.unit === '$' ? null : (
                  <Text as="span" className="text-sm">
                    {words.unit}
                  </Text>
                )}
              </div>
            }
          />
          {showErrors && errors.value ? (
            <FieldStatus status="error">{errors.value}</FieldStatus>
          ) : (
            <FieldDescription>{words.help}</FieldDescription>
          )}
        </Field>
      ) : (
        <Bands draft={draft} set={set} error={showErrors ? errors.bands : null} />
      )}

      <Example draft={draft} />
    </FormSection>
  );
}
