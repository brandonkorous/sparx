'use client';

// "Only count some of them": the "where …" at the end of the report builder's
// sentence (docs/144 §8).

import { Alert, Button, Field, FieldLabel, Select, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { operatorsForKind } from './report-builder-data';
import type { DraftProps } from './report-builder-draft';
import { ConditionRow } from './report-condition-row';

function AddRuleButton({ draft, fields, edit }: DraftProps) {
  return (
    <div>
      <Button
        color="module"
        variant="outline"
        size="sm"
        onClick={() => {
          edit((current) => {
            const first = fields[0];
            return {
              ...current,
              conditions: [
                ...current.conditions,
                {
                  field: first?.path ?? '',
                  operator: operatorsForKind(first?.kind)[0]?.value ?? 'eq',
                },
              ],
            };
          });
        }}
      >
        {draft.conditions.length === 0 ? 'Leave some out' : 'And another rule'}
      </Button>
    </div>
  );
}

function RuleList(props: DraftProps) {
  const { draft, readOnly, edit } = props;
  return (
    <>
      {draft.conditions.length > 1 ? (
        <Field>
          <FieldLabel>Which rules have to hold</FieldLabel>
          <Select
            color="module"
            value={draft.logic}
            disabled={readOnly}
            items={{ AND: 'All of them', OR: 'Any one of them' }}
            onValueChange={(next) =>
              edit((current) => ({ ...current, logic: next as 'AND' | 'OR' }))
            }
          />
        </Field>
      ) : null}
      {draft.conditions.map((condition, index) => (
        <ConditionRow key={index} {...props} condition={condition} index={index} />
      ))}
      {/* Plain prose, not a `FieldDescription`, which throws outside a `<Field>`. */}
      {draft.conditions.length === 0 ? (
        <Text className="text-sm">
          Every one of them counts right now. Add a rule to leave some out. Only deals over a
          certain size, only requests still open, only people in one place.
        </Text>
      ) : null}
      {!readOnly && draft.conditions.length < 6 ? <AddRuleButton {...props} /> : null}
    </>
  );
}

export function FiltersSection(props: DraftProps) {
  return (
    <FormSection title="Only count some of them">
      {props.draft.opaqueFilters ? (
        <Alert color="info">
          This report narrows what it counts in a way that cannot be shown as a simple list of
          rules. It is being kept exactly as it is: saving will not change it.
        </Alert>
      ) : (
        <RuleList {...props} />
      )}
    </FormSection>
  );
}
