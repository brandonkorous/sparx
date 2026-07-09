'use client';

// One row of the rule tree — a leaf predicate { field, op, value }.
//
// Three selects in a row (field / operator / value) plus a delete button.
// `value` editor switches type based on the field's `kind` so the UI never
// asks a user to type a number into a boolean predicate.

import { Trash2 } from 'lucide-react';
import type { SegmentField, SegmentOperator } from '@sparx/crm-schemas';
import { Button, FieldControl, NativeSelect } from '@wizeworks/silicaui-react';

import {
  type FieldKind,
  FIELDS,
  FIELD_INDEX,
  OPERATOR_LABELS,
  operatorsFor,
} from './field-metadata';
import { defaultOperatorFor, opTakesArray, opTakesValue } from './types';

interface Props {
  field: SegmentField;
  op: SegmentOperator;
  value: unknown;
  onChange: (next: { field: SegmentField; op: SegmentOperator; value: unknown }) => void;
  onRemove?: () => void;
}

export function PredicateRow({ field, op, value, onChange, onRemove }: Props) {
  const def = FIELD_INDEX[field];
  const ops = operatorsFor(def.kind);

  function changeField(nextField: SegmentField) {
    const nextOp = defaultOperatorFor(nextField);
    onChange({
      field: nextField,
      op: nextOp,
      value: defaultValueFor(FIELD_INDEX[nextField].kind, nextOp),
    });
  }

  function changeOp(nextOp: SegmentOperator) {
    onChange({ field, op: nextOp, value: defaultValueFor(def.kind, nextOp) });
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      <NativeSelect value={field} onChange={(e) => changeField(e.target.value as SegmentField)}>
        {Array.from(groupBy(FIELDS, (f) => f.group)).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((f) => (
              <option key={f.field} value={f.field}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>

      <NativeSelect value={op} onChange={(e) => changeOp(e.target.value as SegmentOperator)}>
        {ops.map((o) => (
          <option key={o} value={o}>
            {OPERATOR_LABELS[o]}
          </option>
        ))}
      </NativeSelect>

      {opTakesValue(op) && (
        <ValueInput
          kind={def.kind}
          enumValues={def.enumValues}
          isArray={opTakesArray(op)}
          value={value}
          onChange={(v) => onChange({ field, op, value: v })}
        />
      )}

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove predicate"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function ValueInput(props: {
  kind: FieldKind;
  enumValues?: readonly string[];
  isArray: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { kind, enumValues, isArray, value, onChange } = props;
  if (isArray) {
    const asText = Array.isArray(value) ? value.join(', ') : '';
    return (
      <FieldControl
        value={asText}
        onChange={(e) => onChange(parseList(e.target.value, kind))}
        placeholder="comma-separated"
        className="w-56"
      />
    );
  }
  if (kind === 'boolean') {
    return (
      <NativeSelect
        value={value === true ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </NativeSelect>
    );
  }
  if (kind === 'enum' && enumValues) {
    return (
      <NativeSelect
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {enumValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </NativeSelect>
    );
  }
  if (kind === 'number') {
    return (
      <FieldControl
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-32"
      />
    );
  }
  if (kind === 'datetime') {
    return (
      <FieldControl
        type="datetime-local"
        value={typeof value === 'string' ? value.slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      />
    );
  }
  return (
    <FieldControl
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-56"
    />
  );
}

function defaultValueFor(kind: FieldKind, op: SegmentOperator): unknown {
  if (op === 'is_null' || op === 'is_not_null') return undefined;
  if (opTakesArray(op)) return [];
  switch (kind) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    case 'datetime':
      return new Date().toISOString();
    default:
      return '';
  }
}

function parseList(input: string, kind: FieldKind): unknown[] {
  const items = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (kind === 'number') return items.map((s) => Number(s)).filter((n) => !Number.isNaN(n));
  if (kind === 'boolean') return items.map((s) => s === 'true');
  return items;
}

function groupBy<T, K>(items: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}
