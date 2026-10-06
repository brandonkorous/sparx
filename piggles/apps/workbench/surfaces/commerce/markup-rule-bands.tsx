'use client';

// A markup rule's cost ranges: a different markup for cheap and dear items
// (sparx persona issue 086).

import { Button, FieldStatus, Input, NativeSelect, Text } from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { BandMethodName } from './markup-rule-words';
import type { BandDraft, RuleDraft, SetRuleDraft } from './markup-rule-draft';

/** Short labels for a range's own method, where a row has little room. */
const BAND_METHODS: { value: BandMethodName; label: string }[] = [
  { value: 'percentage', label: '% added' },
  { value: 'multiplier', label: '× cost' },
  { value: 'flat', label: '$ added' },
  { value: 'margin_target', label: '% margin' },
];

function NumberBox({
  label,
  value,
  placeholder,
  width,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  width: 'w-20' | 'w-24';
  onChange: (next: string) => void;
}) {
  return (
    <Input
      size="sm"
      color="module"
      inputMode="decimal"
      className={`${width} text-right tabular-nums`}
      aria-label={label}
      {...(placeholder ? { placeholder } : {})}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

function MethodSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BandMethodName;
  onChange: (next: BandMethodName) => void;
}) {
  return (
    <NativeSelect
      size="sm"
      color="module"
      className="w-28"
      aria-label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value as BandMethodName);
      }}
    >
      {BAND_METHODS.map((method) => (
        <option key={method.value} value={method.value}>
          {method.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Where a range starts and ends, in dollars of cost. */
function RangeBoxes({
  which,
  band,
  field,
}: {
  which: string;
  band: BandDraft;
  field: (key: 'from' | 'to') => (next: string) => void;
}) {
  return (
    <>
      <NumberBox
        label={`${which} starts at a cost of`}
        placeholder="From $"
        width="w-24"
        value={band.from}
        onChange={field('from')}
      />
      <NumberBox
        label={`${which} ends at a cost of (blank for no top)`}
        placeholder="and up"
        width="w-24"
        value={band.to}
        onChange={field('to')}
      />
    </>
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
  const field = (key: 'from' | 'to' | 'value') => (next: string) => {
    onChange({ ...band, [key]: next });
  };
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Text as="span" className="w-20 shrink-0 text-sm font-medium">
        {which}
      </Text>
      <RangeBoxes which={which} band={band} field={field} />
      <MethodSelect
        label={`${which} markup`}
        value={band.method}
        onChange={(method) => {
          onChange({ ...band, method });
        }}
      />
      <NumberBox
        label={`${which} amount`}
        width="w-20"
        value={band.value}
        onChange={field('value')}
      />
      <RemoveRange label={`Remove ${which}`} onRemove={onRemove} />
    </li>
  );
}

function RemoveRange({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      color="danger"
      shape="square"
      aria-label={label}
      onClick={onRemove}
    >
      <Icon glyph={faTrashCan} className="size-4" aria-hidden />
    </Button>
  );
}

export function MarkupRuleBands({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  const bands = draft.bands;
  return (
    <div className="flex flex-col gap-2">
      <Text className="text-sm">
        Costs from the first amount up to the second. The cheapest items usually carry the biggest
        markup.
      </Text>
      <ul className="flex flex-col gap-2">
        {bands.map((band, index) => (
          // Rows are only added at the end or removed, so position is a stable key.
          <BandRow
            key={index}
            band={band}
            index={index}
            onChange={(next) => {
              set(
                'bands',
                bands.map((b, i) => (i === index ? next : b))
              );
            }}
            onRemove={() => {
              set(
                'bands',
                bands.filter((_, i) => i !== index)
              );
            }}
          />
        ))}
      </ul>
      {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
      <AddRange
        onAdd={() => {
          const from = bands.at(-1)?.to ?? '0';
          set('bands', [...bands, { from, to: '', method: 'percentage', value: '' }]);
        }}
      />
    </div>
  );
}

function AddRange({ onAdd }: { onAdd: () => void }) {
  return (
    <div>
      <Button size="sm" variant="outline" color="module" onClick={onAdd}>
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add a cost range
      </Button>
    </div>
  );
}
