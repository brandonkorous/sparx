'use client';

// The optional limits on a markup rule: rounding, a least profit or margin, and
// a most it may charge (sparx persona issue 086). Left alone, the price is
// exactly what the markup works out, which is what most rules want.

import { FormSection } from '../../components/form-section';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';
import { RoundingFields } from './markup-rule-rounding';
import { ChoiceField, UnitField } from './markup-rule-fields';
import type { DraftErrors } from './markup-rule-checks';

interface SectionProps {
  draft: RuleDraft;
  set: SetRuleDraft;
  errors: DraftErrors;
  showErrors: boolean;
}

function ceilingItems(current: string) {
  return [
    { value: 'none', label: 'No upper limit' },
    { value: 'compare_at', label: "The product's compare-at price" },
    // Only while a rule already uses it: nothing here sets a maker's price.
    ...(current === 'msrp' ? [{ value: 'msrp', label: "The maker's suggested price" }] : []),
    { value: 'fixed', label: 'A set amount' },
  ];
}

function CeilingFields({ draft, set, errors, showErrors }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <ChoiceField
        label="Never charge more than"
        value={draft.ceilingSrc}
        items={ceilingItems(draft.ceilingSrc)}
        onPick={(next) => {
          set('ceilingSrc', next);
        }}
      />
      {draft.ceilingSrc === 'fixed' ? (
        <UnitField
          label="Most it may charge"
          unit="$"
          value={draft.ceilingValue}
          error={showErrors ? errors.ceilingValue : null}
          help="Per item."
          onChange={(next) => {
            set('ceilingValue', next);
          }}
        />
      ) : null}
    </div>
  );
}

function FloorFields({ draft, set, errors, showErrors }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <UnitField
        label="Always make at least"
        unit="$"
        value={draft.floorProfit}
        error={showErrors ? errors.floorProfit : null}
        help="Profit per item. Leave it blank for no minimum."
        onChange={(next) => {
          set('floorProfit', next);
        }}
      />
      <UnitField
        label="Never less than this margin"
        unit="%"
        value={draft.floorMargin}
        error={showErrors ? errors.floorMargin : null}
        help="Leave it blank for no minimum."
        onChange={(next) => {
          set('floorMargin', next);
        }}
      />
    </div>
  );
}

export function MarkupRuleLimits(props: SectionProps) {
  return (
    <FormSection
      title="Rounding and limits"
      description="Optional. Left alone, the price is exactly what the markup works out."
    >
      <RoundingFields draft={props.draft} set={props.set} />
      <FloorFields {...props} />
      <CeilingFields {...props} />
    </FormSection>
  );
}
