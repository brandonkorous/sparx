'use client';

// The condition editor — the "only if…" filter on a rule (and the "matches"
// filter on a scheduled scan). A group combines simple conditions with AND/OR,
// and a group can hold another group, so this editor is RECURSIVE: each group has
// its own All/Any toggle and a list of children, where a child is either a leaf
// row (detail / is / value) or a nested group. "Add group" nests one level
// deeper, up to the schema's maximum, then hides itself.
//
// Fields and values are open (`field: string`, `value: unknown`), so the field
// uses an autocomplete that suggests common paths while accepting free text, and
// values are lightly coerced (true/false → boolean, numeric → number) so a
// natural entry like `order.total ≥ 100` stores a real number.

import { Autocomplete, Button, Input, Select } from '@wizeworks/silicaui-react';
import { FolderPlus, Plus, Trash2 } from 'lucide-react';
import {
  MAX_CONDITION_DEPTH,
  isConditionGroup,
  type Condition,
  type ConditionGroup,
  type ConditionNode,
  type ConditionOperator,
} from '@wizeworks/automation-schemas';
import {
  COMMON_CONDITION_FIELDS,
  CONDITION_OPERATORS,
  operatorDef,
  primitiveText,
} from './automations-catalog';

function coerceScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
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

const emptyCondition = (): Condition => ({ field: '', operator: 'eq', value: '' });
const emptyGroup = (): ConditionGroup => ({ logic: 'AND', conditions: [] });

const FIELD_SUGGESTIONS = [...COMMON_CONDITION_FIELDS];

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: Condition;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) {
  const def = operatorDef(condition.operator);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-52 min-w-0">
        <Autocomplete
          color="module"
          aria-label="Detail to check"
          items={FIELD_SUGGESTIONS}
          value={condition.field}
          placeholder="customer.type"
          className="font-mono"
          onValueChange={(field) => {
            onChange({ ...condition, field });
          }}
        />
      </div>
      <div className="w-36 shrink-0">
        <Select
          color="module"
          aria-label="Comparison"
          value={condition.operator}
          items={Object.fromEntries(CONDITION_OPERATORS.map((o) => [o.value, o.label]))}
          onValueChange={(next) => {
            const op = operatorDef(next as ConditionOperator);
            onChange({
              ...condition,
              operator: next as ConditionOperator,
              value: op?.valueless ? undefined : '',
            });
          }}
        />
      </div>
      {def?.valueless ? null : (
        <div className="w-44 min-w-0">
          <Input
            color="module"
            aria-label="Value"
            value={valueToInputText(condition.value)}
            placeholder={def?.list ? 'a, b, c' : 'value'}
            onChange={(event) => {
              onChange({
                ...condition,
                value: def?.list
                  ? coerceList(event.target.value)
                  : coerceScalar(event.target.value),
              });
            }}
          />
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        color="danger"
        shape="square"
        aria-label="Remove this condition"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function ConditionEditor({
  value,
  onChange,
  label = 'conditions',
  emptyNote = 'No conditions yet — this runs every time its trigger happens.',
  depth = 1,
  onRemove,
}: {
  value: ConditionGroup;
  onChange: (next: ConditionGroup) => void;
  /** Noun for the "the following …" copy (a scan reuses "records"). */
  label?: string;
  /**
   * What an EMPTY set of conditions means here, in the caller's own terms.
   *
   * The default is an automation's answer, and it used to be the only answer:
   * an automation with no conditions really does run every time its trigger
   * fires. A campaign's goal is the opposite — empty means it cannot be turned
   * on at all — so a campaign showed "this runs every time its trigger
   * happens" directly beneath its own sentence saying it could not run, about a
   * trigger it does not have. Two adjacent lines contradicting each other, and
   * the wrong one was the one in the empty state, which is exactly where
   * somebody looks when they are stuck.
   */
  emptyNote?: string;
  /** 1 at the root; increments per nesting level (caps "Add group" at the max). */
  depth?: number;
  /** Present on a nested sub-group → renders its remove control. */
  onRemove?: () => void;
}) {
  const isRoot = depth === 1;
  const canNest = depth < MAX_CONDITION_DEPTH;

  function updateNode(index: number, next: ConditionNode) {
    onChange({ ...value, conditions: value.conditions.map((c, i) => (i === index ? next : c)) });
  }

  function removeNode(index: number) {
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  }

  return (
    <div
      className={
        isRoot
          ? 'flex flex-col gap-3'
          : 'border-base-300 bg-base-200 flex flex-col gap-3 rounded-lg border p-3'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Match</span>
        <div className="w-28">
          <Select
            size="sm"
            color="module"
            aria-label="Match all or any"
            value={value.logic}
            items={{ AND: 'all of', OR: 'any of' }}
            onValueChange={(next) => {
              onChange({ ...value, logic: next as 'AND' | 'OR' });
            }}
          />
        </div>
        <span className="text-sm">the following {label}</span>
        {onRemove ? (
          <Button
            variant="ghost"
            size="sm"
            color="danger"
            shape="square"
            className="ml-auto"
            aria-label="Remove this group"
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {value.conditions.length === 0 ? (
        <p className="text-sm">{isRoot ? emptyNote : 'Empty group — add a condition.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.conditions.map((node, i) =>
            isConditionGroup(node) ? (
              <ConditionEditor
                key={i}
                depth={depth + 1}
                label={label}
                value={node}
                onChange={(next) => {
                  updateNode(i, next);
                }}
                onRemove={() => {
                  removeNode(i);
                }}
              />
            ) : (
              <ConditionRow
                key={i}
                // `isConditionGroup` narrows the group branch; the leaf branch is
                // a Condition, but the guard can't structurally exclude it.
                condition={node as Condition}
                onChange={(next) => {
                  updateNode(i, next);
                }}
                onRemove={() => {
                  removeNode(i);
                }}
              />
            )
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="soft"
          color="module"
          size="sm"
          onClick={() => {
            onChange({ ...value, conditions: [...value.conditions, emptyCondition()] });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a condition
        </Button>
        {canNest ? (
          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={() => {
              onChange({ ...value, conditions: [...value.conditions, emptyGroup()] });
            }}
          >
            <FolderPlus className="size-4" aria-hidden />
            Add a group
          </Button>
        ) : null}
      </div>
    </div>
  );
}
