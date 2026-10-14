'use client';

// One "only where …" rule in the report builder: a field, a comparison, and
// what to compare it with (docs/144 §8).

import { Button, Field, FieldLabel, Input, Select, Text } from '@wizeworks/silicaui-react';

import {
  operatorsForKind,
  type ConditionLeaf,
  type FilterOperator,
  type ReportField,
} from './report-builder-data';
import { coerce, isComplete, valueText, type DraftProps } from './report-builder-draft';

interface RuleProps {
  condition: ConditionLeaf;
  field: ReportField | undefined;
  readOnly: boolean;
  change: (patch: Partial<ConditionLeaf>) => void;
}

function RuleField({
  condition,
  readOnly,
  change,
  fields,
  first,
}: RuleProps & {
  fields: ReportField[];
  first: boolean;
}) {
  return (
    <Field>
      <FieldLabel>{first ? 'Only where' : 'And where'}</FieldLabel>
      <Select
        color="module"
        aria-label="Which value to check"
        value={condition.field}
        disabled={readOnly}
        items={Object.fromEntries(fields.map((f) => [f.path, f.label]))}
        onValueChange={(next) => {
          // A new field's comparisons differ, and the old value is not its value.
          const picked = fields.find((f) => f.path === (next as string));
          const firstOperator = operatorsForKind(picked?.kind)[0];
          change({
            field: next as string,
            operator: firstOperator?.value ?? 'eq',
            // A Yes/No control shows "No" even when empty, so seed what it shows:
            // what is on screen is then what is stored.
            value: picked?.kind === 'boolean' ? false : undefined,
          });
        }}
      />
    </Field>
  );
}

function RuleOperator({
  condition,
  field,
  readOnly,
  change,
  operators,
}: RuleProps & {
  operators: FilterOperator[];
}) {
  return (
    <div className="min-w-[10rem] flex-1">
      <Select
        color="module"
        aria-label="How to compare it"
        value={condition.operator}
        disabled={readOnly}
        items={Object.fromEntries(operators.map((o) => [o.value, o.label]))}
        onValueChange={(next) => {
          const picked = operators.find((o) => o.value === (next as string));
          change({
            operator: next as string,
            ...(picked?.needsValue
              ? // Back to a comparison with a value: seed a Yes/No, as above.
                field?.kind === 'boolean' && condition.value === undefined
                ? { value: false }
                : {}
              : { value: undefined }),
          });
        }}
      />
    </div>
  );
}

function RuleValue({ condition, field, readOnly, change }: RuleProps) {
  return (
    <div className="min-w-[10rem] flex-1">
      {field?.kind === 'boolean' ? (
        <Select
          color="module"
          aria-label="What to compare it with"
          value={condition.value === true ? 'true' : 'false'}
          disabled={readOnly}
          items={{ true: 'Yes', false: 'No' }}
          onValueChange={(next) => {
            change({ value: next === 'true' });
          }}
        />
      ) : (
        <Input
          color="module"
          aria-label="What to compare it with"
          type={
            field?.kind === 'date'
              ? 'date'
              : field?.kind === 'number' || field?.kind === 'currency'
                ? 'number'
                : 'text'
          }
          value={valueText(condition.value)}
          disabled={readOnly}
          placeholder="Type what to look for"
          onChange={(event) => {
            change({ value: coerce(event.target.value, field?.kind) });
          }}
        />
      )}
    </div>
  );
}

export function ConditionRow(props: DraftProps & { condition: ConditionLeaf; index: number }) {
  const { condition, index, readOnly, fields, edit } = props;
  const field = fields.find((f) => f.path === condition.field);
  const operators = operatorsForKind(field?.kind);
  const operator = operators.find((o) => o.value === condition.operator);
  const change = (patch: Partial<ConditionLeaf>) => {
    edit((current) => {
      const conditions = [...current.conditions];
      conditions[index] = { ...conditions[index], ...patch } as ConditionLeaf;
      return { ...current, conditions };
    });
  };
  const rule = { condition, field, readOnly, change };
  return (
    <div className="flex flex-col gap-2">
      <RuleField {...rule} fields={fields} first={index === 0} />
      <div className="flex flex-wrap items-end gap-2">
        <RuleOperator {...rule} operators={operators} />
        {operator?.needsValue ? <RuleValue {...rule} /> : null}
        {!readOnly ? (
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Remove this rule"
            onClick={() => {
              edit((current) => ({
                ...current,
                conditions: current.conditions.filter((_, i) => i !== index),
              }));
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {isComplete(condition) ? null : (
        <Text className="text-sm">
          Not narrowing anything yet. This rule needs something to compare with.
        </Text>
      )}
    </div>
  );
}
