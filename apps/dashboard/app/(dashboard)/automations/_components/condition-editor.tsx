'use client';

// Condition-group editor — the "run only if…" filter (docs/81 §5.3). The schema
// is a FLAT group ({ logic: AND|OR, conditions[] }); nested groups are a Phase 6
// item, so this editor is intentionally one level deep. Reused for a scheduled
// trigger's predicate `where` (the row SELECTOR), which is the same shape.
//
// Condition fields + values are open (`field: string`, `value: unknown`), so the
// field input offers curated suggestions via a datalist but accepts free text,
// and values are lightly coerced (true/false → boolean, numeric → number) so a
// natural entry like `customer.totalSpent ≥ 100` stores a real number.

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { Condition, ConditionGroup, ConditionOperator } from '@sparx/automation-schemas';
import {
  COMMON_CONDITION_FIELDS,
  CONDITION_OPERATORS,
  operatorDef,
  primitiveText,
} from '../_lib/catalog';

const FIELD_DATALIST_ID = 'automation-condition-fields';

function coerceScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  const n = Number(s);
  if (s !== '' && Number.isFinite(n)) return n;
  return s;
}

function coerceList(raw: string): unknown[] {
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => coerceScalar(p));
}

function valueToInputText(value: unknown): string {
  if (Array.isArray(value)) return value.map(primitiveText).join(', ');
  return primitiveText(value);
}

interface Props {
  value: ConditionGroup;
  onChange: (next: ConditionGroup) => void;
  /** Label above the logic toggle; the predicate reuses this with its own copy. */
  label?: string;
}

export function ConditionEditor({ value, onChange, label = 'Conditions' }: Props) {
  function setLogic(logic: 'AND' | 'OR') {
    onChange({ ...value, logic });
  }

  function addCondition() {
    const next: Condition = { field: '', operator: 'eq', value: '' };
    onChange({ ...value, conditions: [...value.conditions, next] });
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    onChange({
      ...value,
      conditions: value.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  }

  function removeCondition(index: number) {
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  }

  function changeOperator(index: number, operator: ConditionOperator) {
    const def = operatorDef(operator);
    // Reset the value when moving to/from a valueless operator so we never persist
    // a stray value on `is_set`.
    const value0 = def?.valueless ? undefined : '';
    updateCondition(index, { operator, value: value0 });
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id={FIELD_DATALIST_ID}>
        {COMMON_CONDITION_FIELDS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Match</Label>
        <Select value={value.logic} onValueChange={(v) => setLogic(v as 'AND' | 'OR')}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">All of</SelectItem>
            <SelectItem value="OR">Any of</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-[var(--color-text-secondary)]">
          the following {label.toLowerCase()}
        </span>
      </div>

      {value.conditions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No conditions — the automation runs on every trigger.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.conditions.map((c, i) => {
            const def = operatorDef(c.operator);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  list={FIELD_DATALIST_ID}
                  value={c.field}
                  placeholder="customer.type"
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                  className="w-56 font-mono text-sm"
                  aria-label="Field"
                />
                <Select
                  value={c.operator}
                  onValueChange={(v) => changeOperator(i, v as ConditionOperator)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!def?.valueless && (
                  <Input
                    value={valueToInputText(c.value)}
                    placeholder={def?.list ? 'a, b, c' : 'value'}
                    onChange={(e) =>
                      updateCondition(i, {
                        value: def?.list
                          ? coerceList(e.target.value)
                          : coerceScalar(e.target.value),
                      })
                    }
                    className="w-48 text-sm"
                    aria-label="Value"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  color="danger"
                  onClick={() => removeCondition(i)}
                  aria-label="Remove condition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={addCondition}
        >
          Add condition
        </Button>
      </div>
    </div>
  );
}
