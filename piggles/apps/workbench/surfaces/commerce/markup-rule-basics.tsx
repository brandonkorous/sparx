'use client';

// A markup rule's name, what it prices, and whether it is in use (sparx persona
// issue 086).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Switch,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { APPLIES_TO_WORDS, type AppliesTo } from './markup-rule-words';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';
import { ChoiceField } from './markup-rule-fields';

const APPLIES_TO_ITEMS = (Object.keys(APPLIES_TO_WORDS) as AppliesTo[]).map((value) => ({
  value,
  label: APPLIES_TO_WORDS[value],
}));

function InUse({ draft, set }: { draft: RuleDraft; set: SetRuleDraft }) {
  return (
    <Field>
      <div className="flex items-start gap-3">
        <Switch
          color="module"
          aria-label="In use"
          checked={draft.isActive}
          onCheckedChange={(checked) => {
            set('isActive', checked === true);
          }}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel>In use</FieldLabel>
          <FieldDescription>
            Turned off, it is not offered on quote lines and stops repricing products when their
            cost changes.
          </FieldDescription>
        </div>
      </div>
    </Field>
  );
}

export function MarkupRuleBasics({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  return (
    <FormSection title="The rule">
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color={error ? 'error' : 'module'}
              value={draft.name}
              placeholder="Parts plus 40%"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
        {error ? (
          <FieldStatus status="error">{error}</FieldStatus>
        ) : (
          <FieldDescription>What you will pick it by on a quote line.</FieldDescription>
        )}
      </Field>
      <ChoiceField
        label="What it prices"
        value={draft.appliesTo}
        items={APPLIES_TO_ITEMS}
        help="Quote and invoice lines offer it when you price a line. The catalog uses it to set the prices on your products."
        onPick={(next) => {
          set('appliesTo', next as AppliesTo);
        }}
      />
      <InUse draft={draft} set={set} />
    </FormSection>
  );
}
