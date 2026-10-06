'use client';

// "How often" — buy it once, or have it delivered again on a schedule (issue 739).
//
// The React twin of the builder buy box's `repeatPicker`, for the pages that draw
// `<ProductDetail>` and for a basket line that offers a change. Same words, same
// order, "Buy once" first and the default, and the same sentence under it, so a
// shopper meets one promise whichever page they are on.

import { cadenceKey, cadenceLabel, type RepeatCadence } from '@wizeworks/commerce-schemas';
import { useId } from 'react';

import { REPEAT_NOTE } from '@/lib/repeat-copy';

export function RepeatChoice({
  options,
  value,
  onChange,
  disabled = false,
  showNote = true,
}: {
  options: RepeatCadence[];
  value: RepeatCadence | null;
  onChange: (next: RepeatCadence | null) => void;
  disabled?: boolean;
  /** The basket leaves the sentence out under each line; the buy box needs it. */
  showNote?: boolean;
}) {
  const name = useId();
  if (options.length === 0) return null;
  const current = value ? cadenceKey(value) : '';
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-base-content text-base font-medium">How often</legend>
      <label className="text-base-content flex items-center gap-2 text-base">
        <input
          type="radio"
          className="radio"
          name={name}
          value=""
          checked={current === ''}
          onChange={() => {
            onChange(null);
          }}
        />
        <span>Buy once</span>
      </label>
      {options.map((option) => {
        const key = cadenceKey(option);
        return (
          <label key={key} className="text-base-content flex items-center gap-2 text-base">
            <input
              type="radio"
              className="radio"
              name={name}
              value={key}
              checked={current === key}
              onChange={() => {
                onChange(option);
              }}
            />
            <span>{cadenceLabel(option)}</span>
          </label>
        );
      })}
      {showNote ? <p className="text-base-content text-base">{REPEAT_NOTE}</p> : null}
    </fieldset>
  );
}
