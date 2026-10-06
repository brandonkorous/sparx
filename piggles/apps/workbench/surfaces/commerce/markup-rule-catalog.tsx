'use client';

// A markup rule on the catalog: which cost it starts from, which rule wins, and
// what happens when a cost moves (sparx persona issue 086). Catalog rules only.

import { Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { ScopeFields } from './markup-rule-scope';
import { ChoiceField, UnitField } from './markup-rule-fields';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';
import type { DraftErrors } from './markup-rule-checks';

const COST_BASES = [
  { value: 'variant_cost', label: 'The cost on the product' },
  { value: 'supplier_cost', label: "Your supplier's current cost" },
];

const ON_COST_CHANGE = [
  { value: 'auto', label: 'Update its price' },
  { value: 'review', label: 'Ask me before changing its price' },
  { value: 'off', label: 'Leave its price alone' },
];

interface SectionProps {
  draft: RuleDraft;
  set: SetRuleDraft;
  errors: DraftErrors;
  showErrors: boolean;
}

function BasisAndRank({ draft, set, errors, showErrors }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <ChoiceField
        label="Start from"
        value={draft.costBasis}
        items={COST_BASES}
        onPick={(next) => {
          set('costBasis', next);
        }}
      />
      <UnitField
        label="Rank"
        unit=""
        value={draft.priority}
        error={showErrors ? errors.priority : null}
        help="When two rules cover the same product, the higher number wins."
        onChange={(next) => {
          set('priority', next);
        }}
      />
    </div>
  );
}

function RecomputeFields({ draft, set, errors, showErrors }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <ChoiceField
        label="When a product's cost changes"
        value={draft.recomputeMode}
        items={ON_COST_CHANGE}
        onPick={(next) => {
          set('recomputeMode', next);
        }}
      />
      {draft.recomputeMode === 'auto' ? (
        <UnitField
          label="Ask me first if a price would move more than"
          unit="%"
          value={draft.tolerance}
          error={showErrors ? errors.tolerance : null}
          help="Leave it blank to always update."
          onChange={(next) => {
            set('tolerance', next);
          }}
        />
      ) : null}
    </div>
  );
}

export function MarkupRuleCatalog({
  apply,
  ...section
}: SectionProps & {
  /** The Apply block, for a saved rule; null while the rule is new. */
  apply: React.ReactNode;
}) {
  return (
    <FormSection
      title="Your catalog"
      description="How this rule prices the products it is applied to."
    >
      <BasisAndRank {...section} />
      <ScopeFields draft={section.draft} set={section.set} showErrors={section.showErrors} />
      <RecomputeFields {...section} />
      {apply ?? (
        <Text className="text-sm">Save the rule first, then apply it to your products.</Text>
      )}
    </FormSection>
  );
}
