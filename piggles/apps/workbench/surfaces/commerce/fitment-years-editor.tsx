'use client';

// Changing the years on a fit that is already there (sparx persona issue 330).
//
// A fit could take years only when it was added, so a part entered as
// "RAM 2500, 6.7L Cummins" with no years kept fitting every year for good. The
// only way to add them was to remove the entry and add it again, which also
// threw away its note. The "Pairs well with" suggestions read these years, and a
// 2019 to 2022 turbo was offered beside an injector for 2007.5 to 2018.

import { useState } from 'react';
import { Button, Field, FieldLabel, Input, Text } from '@wizeworks/silicaui-react';

import type { FitmentDimension, ProductFitmentRange } from './products-data';
import { rangesFromDrafts, type RangeDraft } from './fitment-rule-words';

export function FitmentYearsEditor({
  label,
  dimensions,
  ranges,
  pending,
  onSave,
}: {
  /** The entry, as a phrase: "RAM › 2500 › 6.7L Cummins". */
  label: string;
  /** The list's range dimensions only (years, sizes). */
  dimensions: readonly FitmentDimension[];
  ranges: readonly ProductFitmentRange[];
  pending: boolean;
  onSave: (ranges: ProductFitmentRange[], done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const start = (): Record<string, RangeDraft> =>
    Object.fromEntries(
      dimensions.map((d) => {
        const r = ranges.find((x) => x.dimensionKey === d.key);
        return [
          d.key,
          { min: r?.min == null ? '' : String(r.min), max: r?.max == null ? '' : String(r.max) },
        ];
      })
    );
  const [drafts, setDrafts] = useState<Record<string, RangeDraft>>(start);
  const { ranges: next, problem } = rangesFromDrafts(dimensions, drafts);

  if (dimensions.length === 0) return null;
  if (!open) {
    const word = dimensions.length === 1 ? dimensions[0]!.label.toLowerCase() : 'details';
    // The same words on screen and to a screen reader.
    const verb = ranges.length > 0 ? 'Change' : 'Add';
    return (
      <div>
        <Button
          size="xs"
          variant="ghost"
          color="module"
          aria-label={`${verb} the ${word} for ${label}`}
          onClick={() => {
            setDrafts(start());
            setOpen(true);
          }}
        >
          {`${verb} the ${word}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {dimensions.map((dimension) => (
        <Field key={dimension.key}>
          <FieldLabel>{dimension.label}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              color="module"
              size="sm"
              type="number"
              inputMode="numeric"
              placeholder="From"
              aria-label={`${dimension.label} from`}
              value={drafts[dimension.key]?.min ?? ''}
              onChange={(event) => {
                const min = event.target.value;
                setDrafts((current) => ({
                  ...current,
                  [dimension.key]: { min, max: current[dimension.key]?.max ?? '' },
                }));
              }}
            />
            <Text aria-hidden>–</Text>
            <Input
              color="module"
              size="sm"
              type="number"
              inputMode="numeric"
              placeholder="To"
              aria-label={`${dimension.label} to`}
              value={drafts[dimension.key]?.max ?? ''}
              onChange={(event) => {
                const max = event.target.value;
                setDrafts((current) => ({
                  ...current,
                  [dimension.key]: { min: current[dimension.key]?.min ?? '', max },
                }));
              }}
            />
          </div>
        </Field>
      ))}
      {problem ? (
        <Text className="text-danger text-sm" role="alert">
          {problem}
        </Text>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          color="module"
          loading={pending}
          disabled={pending || problem !== null}
          onClick={() => {
            onSave(next, () => setOpen(false));
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
