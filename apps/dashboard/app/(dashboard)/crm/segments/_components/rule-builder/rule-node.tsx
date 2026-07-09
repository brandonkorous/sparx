'use client';

// A node in the rule tree — dispatches between predicate row and group.
// Recursive: a group's children are rendered as RuleNodes themselves.

import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button } from '@wizeworks/silicaui-react';

import { PredicateRow } from './predicate-row';
import { type GroupKind, type Rule, emptyGroup, emptyNot, emptyPredicate } from './types';

interface Props {
  rule: Rule;
  onChange: (next: Rule) => void;
  /** Omitted for the root node (you can't delete the root). */
  onRemove?: () => void;
  depth?: number;
}

export function RuleNode({ rule, onChange, onRemove, depth = 0 }: Props) {
  if (rule.kind === 'predicate') {
    return (
      <PredicateRow
        field={rule.field}
        op={rule.op}
        value={rule.value}
        onChange={(next) =>
          onChange({
            kind: 'predicate',
            field: next.field,
            op: next.op,
            // SegmentRule's value union is the JSON-serialisable types we
            // validate elsewhere; widen via cast here since the UI surface
            // already constrains the runtime shape to those types.
            value: next.value as Extract<typeof rule, { kind: 'predicate' }>['value'],
          })
        }
        onRemove={onRemove}
      />
    );
  }

  if (rule.kind === 'not') {
    return (
      <div className="border-base-300 flex flex-col gap-2 rounded-md border border-dashed p-3">
        <div className="flex flex-row items-center justify-between">
          <Badge color="warning" variant="soft" size="sm">
            NOT
          </Badge>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove NOT"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <RuleNode
          rule={rule.child}
          depth={depth + 1}
          onChange={(child) => onChange({ kind: 'not', child })}
        />
      </div>
    );
  }

  // AND / OR
  const groupKind: GroupKind = rule.kind;
  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-row items-center justify-between">
        <select
          className="border-base-300 bg-base-100 rounded-md border px-2 py-1 text-xs font-medium uppercase"
          value={groupKind}
          onChange={(e) => onChange({ kind: e.target.value as GroupKind, children: rule.children })}
        >
          <option value="and">All of</option>
          <option value="or">Any of</option>
        </select>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label="Remove group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rule.children.map((child, idx) => (
          <RuleNode
            key={idx}
            rule={child}
            depth={depth + 1}
            onChange={(next) =>
              onChange({
                kind: groupKind,
                children: rule.children.map((c, i) => (i === idx ? next : c)),
              })
            }
            onRemove={
              rule.children.length > 1
                ? () =>
                    onChange({
                      kind: groupKind,
                      children: rule.children.filter((_, i) => i !== idx),
                    })
                : undefined
            }
          />
        ))}
      </div>

      <div className="flex flex-row gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ kind: groupKind, children: [...rule.children, emptyPredicate()] })
          }
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          Add condition
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ kind: groupKind, children: [...rule.children, emptyGroup('and')] })
          }
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          Add group
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ kind: groupKind, children: [...rule.children, emptyNot()] })}
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          Add NOT
        </Button>
      </div>
    </div>
  );
}
