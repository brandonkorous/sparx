'use client';

// Condition-group editor — the "run only if…" filter (docs/81 §5.3). A group
// combines leaf conditions AND/OR nested sub-groups, so the editor is RECURSIVE:
// each group has its own All/Any toggle and a list of children, where a child is
// either a leaf row (field / operator / value) or another group. "Add group"
// nests one level deeper, up to MAX_CONDITION_DEPTH (then it's hidden — the schema
// rejects deeper trees). Reused for a scheduled trigger's predicate `where`.
//
// Condition fields + values are open (`field: string`, `value: unknown`), so the
// field input is a <Combobox> offering curated suggestions while accepting free
// text, and values are lightly coerced (true/false → boolean, numeric → number)
// so a natural entry like `customer.totalSpent ≥ 100` stores a real number.

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
import { FolderPlus, Plus, Trash2 } from 'lucide-react';
import {
  MAX_CONDITION_DEPTH,
  isConditionGroup,
  type Condition,
  type ConditionGroup,
  type ConditionNode,
  type ConditionOperator,
} from '@sparx/automation-schemas';
import {
  COMMON_CONDITION_FIELDS,
  CONDITION_OPERATORS,
  operatorDef,
  primitiveText,
} from '../_lib/catalog';
import { Combobox } from './combobox';

const FIELD_OPTIONS = COMMON_CONDITION_FIELDS.map((f) => ({ value: f }));

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

const emptyCondition = (): Condition => ({ field: '', operator: 'eq', value: '' });
const emptyGroup = (): ConditionGroup => ({ logic: 'AND', conditions: [] });

/** One leaf condition: field / operator / value + remove. */
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

  function changeOperator(operator: ConditionOperator) {
    const next = operatorDef(operator);
    onChange({ ...condition, operator, value: next?.valueless ? undefined : '' });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Combobox
        value={condition.field}
        onChange={(field) => onChange({ ...condition, field })}
        options={FIELD_OPTIONS}
        placeholder="customer.type"
        searchPlaceholder="Search or type a field…"
        customHint="Use this exact field"
        triggerClassName="w-56"
        aria-label="Field"
      />
      <Select
        value={condition.operator}
        onValueChange={(v) => changeOperator(v as ConditionOperator)}
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
          value={valueToInputText(condition.value)}
          placeholder={def?.list ? 'a, b, c' : 'value'}
          onChange={(e) =>
            onChange({
              ...condition,
              value: def?.list ? coerceList(e.target.value) : coerceScalar(e.target.value),
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
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface Props {
  value: ConditionGroup;
  onChange: (next: ConditionGroup) => void;
  /** Noun for the "the following …" copy (the predicate reuses "rows"). */
  label?: string;
  /** 1 at the root; increments per nesting level (caps "Add group" at the max). */
  depth?: number;
  /** Present on a nested sub-group → renders a remove control. */
  onRemove?: () => void;
}

export function ConditionEditor({
  value,
  onChange,
  label = 'conditions',
  depth = 1,
  onRemove,
}: Props) {
  const isRoot = depth === 1;
  const canNest = depth < MAX_CONDITION_DEPTH;

  function setLogic(logic: 'AND' | 'OR') {
    onChange({ ...value, logic });
  }

  function updateNode(index: number, next: ConditionNode) {
    onChange({
      ...value,
      conditions: value.conditions.map((c, i) => (i === index ? next : c)),
    });
  }

  function removeNode(index: number) {
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  }

  function addCondition() {
    onChange({ ...value, conditions: [...value.conditions, emptyCondition()] });
  }

  function addGroup() {
    onChange({ ...value, conditions: [...value.conditions, emptyGroup()] });
  }

  return (
    <div
      className={
        isRoot
          ? 'flex flex-col gap-3'
          : 'flex flex-col gap-3 rounded-md border-l-2 border-[var(--module-active)] bg-[var(--color-bg-subtle)] p-3'
      }
    >
      <div className="flex items-center justify-between gap-2">
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
          <span className="text-sm text-[var(--color-text-secondary)]">the following {label}</span>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            color="danger"
            onClick={onRemove}
            aria-label="Remove group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {value.conditions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {isRoot
            ? 'No conditions — the automation runs on every trigger.'
            : 'Empty group — add a condition.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.conditions.map((node, i) =>
            isConditionGroup(node) ? (
              <ConditionEditor
                key={i}
                depth={depth + 1}
                label={label}
                value={node}
                onChange={(next) => updateNode(i, next)}
                onRemove={() => removeNode(i)}
              />
            ) : (
              <ConditionRow
                key={i}
                condition={node as Condition}
                onChange={(next) => updateNode(i, next)}
                onRemove={() => removeNode(i)}
              />
            )
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="soft"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={addCondition}
        >
          Add condition
        </Button>
        {canNest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<FolderPlus className="h-3.5 w-3.5" />}
            onClick={addGroup}
          >
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}
