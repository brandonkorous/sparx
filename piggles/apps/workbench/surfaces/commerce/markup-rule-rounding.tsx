'use client';

// How a markup rule rounds the price it works out (sparx persona issue 086).

import type { RoundingChoice } from './markup-rule-words';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';
import { ChoiceField } from './markup-rule-fields';

const ROUNDING: { value: RoundingChoice; label: string }[] = [
  { value: 'none', label: 'Leave the cents as they work out' },
  { value: 'nearest', label: 'Round to the nearest…' },
  { value: 'charm', label: 'Make every price end in…' },
];

const NEAREST = [5, 10, 25, 50, 100];
const ENDINGS = [99, 95, 49, 0];

/** The choices, plus one a rule already holds that is not among them, so a
 *  rule made elsewhere is shown as it is rather than as the first option. */
function choices(list: number[], current: number, label: (n: number) => string) {
  const all = list.includes(current) ? list : [...list, current].sort((a, b) => a - b);
  return all.map((n) => ({ value: String(n), label: label(n) }));
}

export function RoundingFields({ draft, set }: { draft: RuleDraft; set: SetRuleDraft }) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <ChoiceField
        label="Rounding"
        value={draft.rounding}
        items={ROUNDING}
        onPick={(next) => {
          set('rounding', next as RoundingChoice);
        }}
      />
      {draft.rounding === 'nearest' ? (
        <ChoiceField
          label="Round to the nearest"
          value={String(draft.precisionCents)}
          items={choices(NEAREST, draft.precisionCents, (n) => `$${(n / 100).toFixed(2)}`)}
          onPick={(next) => {
            set('precisionCents', Number(next));
          }}
        />
      ) : null}
      {draft.rounding === 'charm' ? (
        <ChoiceField
          label="Every price ends in"
          value={String(draft.endingCents)}
          items={choices(ENDINGS, draft.endingCents, (n) => `.${String(n).padStart(2, '0')}`)}
          help="Prices round up to the next one that ends this way."
          onPick={(next) => {
            set('endingCents', Number(next));
          }}
        />
      ) : null}
    </div>
  );
}
