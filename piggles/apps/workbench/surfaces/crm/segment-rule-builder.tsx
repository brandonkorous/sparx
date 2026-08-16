'use client';

// The predicate builder — the recursive UI over a segment's rule tree.
//
// A group is a card: a header that reads "include customers that match all of
// these", then its conditions, then a nested group if you need one branch to say
// something different. A condition is a field, an operator and a value, each a
// real <Select>/<Input> — never a hand-rolled control. The whole thing is
// controlled: every node takes its value plus `onChange`/`onRemove`, and edits
// bubble up immutably to the one `root` the pane owns, so the pane's dirty guard
// and the live preview both see every keystroke.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { faFolderPlus, faPlus, faTrashCan, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  fieldMeta,
  fieldOptionsIncluding,
  newGroup,
  newPredicate,
  operatorIsList,
  operatorIsRange,
  operatorOptionsIncluding,
  operatorTakesValue,
  type EditorNode,
  type GroupNode,
  type PredNode,
  type SegmentField,
  type SegmentOperator,
} from './segment-rules';

const MAX_DEPTH = 2;

/** Build Select items from an options list, always including `current` so a
 *  stored value the list would not otherwise carry still shows. */
function itemsIncluding(
  options: { value: string; label: string }[],
  current: string,
  currentLabel?: string
): Record<string, string> {
  const items: Record<string, string> = {};
  for (const opt of options) items[opt.value] = opt.label;
  if (current !== '' && !(current in items)) items[current] = currentLabel ?? current;
  return items;
}

/* ── Value control ──────────────────────────────────────────────────────── */

function ValueControl({
  node,
  onChange,
  repItems,
  accountItems,
}: {
  node: PredNode;
  onChange: (next: PredNode) => void;
  repItems: Record<string, string>;
  accountItems: Record<string, string>;
}) {
  const meta = fieldMeta(node.field);
  const set = (value: string) => {
    onChange({ ...node, value });
  };
  const set2 = (value2: string) => {
    onChange({ ...node, value2 });
  };

  if (!operatorTakesValue(node.op)) return null;

  if (operatorIsRange(node.op)) {
    const type = meta.kind === 'date' ? 'date' : 'number';
    return (
      <div className="flex items-center gap-2">
        <Input
          color="module"
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          aria-label="From"
          className="max-w-[9rem]"
          value={node.value}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
        <Text as="span" className="text-sm">
          and
        </Text>
        <Input
          color="module"
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          aria-label="To"
          className="max-w-[9rem]"
          value={node.value2}
          onChange={(event) => {
            set2(event.target.value);
          }}
        />
      </div>
    );
  }

  if (operatorIsList(node.op)) {
    return (
      <Input
        color="module"
        aria-label="Values"
        placeholder="value one, value two"
        value={node.value}
        onChange={(event) => {
          set(event.target.value);
        }}
      />
    );
  }

  switch (meta.kind) {
    case 'enum':
      return (
        <Select
          color="module"
          aria-label="Value"
          value={node.value}
          items={itemsIncluding(meta.options ?? [], node.value)}
          onValueChange={(next) => {
            set(next as string);
          }}
        />
      );
    case 'boolean':
      return (
        <Select
          color="module"
          aria-label="Value"
          value={node.value}
          items={{ true: 'Yes', false: 'No' }}
          onValueChange={(next) => {
            set(next as string);
          }}
        />
      );
    case 'number':
      return (
        <Input
          color="module"
          type="number"
          inputMode="decimal"
          aria-label="Value"
          className="max-w-[12rem]"
          value={node.value}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
      );
    case 'date':
      return (
        <Input
          color="module"
          type="date"
          aria-label="Value"
          className="max-w-[12rem]"
          value={node.value}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
      );
    case 'rep':
      return (
        <Select
          color="module"
          aria-label="Team member"
          value={node.value}
          items={itemsIncluding(
            Object.entries(repItems).map(([value, label]) => ({ value, label })),
            node.value,
            'A former team member'
          )}
          onValueChange={(next) => {
            set(next as string);
          }}
        />
      );
    case 'account':
      return (
        <Select
          color="module"
          aria-label="Wholesale account"
          value={node.value}
          items={itemsIncluding(
            Object.entries(accountItems).map(([value, label]) => ({ value, label })),
            node.value,
            'A removed account'
          )}
          onValueChange={(next) => {
            set(next as string);
          }}
        />
      );
    default:
      return (
        <Input
          color="module"
          aria-label="Value"
          placeholder={meta.kind === 'tags' ? 'A label' : 'A value'}
          value={node.value}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
      );
  }
}

/* ── One condition ──────────────────────────────────────────────────────── */

function PredicateEditor({
  node,
  onChange,
  onRemove,
  repItems,
  accountItems,
}: {
  node: PredNode;
  onChange: (next: PredNode) => void;
  onRemove: () => void;
  repItems: Record<string, string>;
  accountItems: Record<string, string>;
}) {
  const meta = fieldMeta(node.field);

  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel>Field</FieldLabel>
          <Select
            color="module"
            aria-label="Field"
            value={node.field}
            items={Object.fromEntries(
              fieldOptionsIncluding(node.field).map((o) => [o.value, o.label])
            )}
            onValueChange={(next) => {
              // Changing the field resets the operator and value to sensible
              // defaults for the new field, keeping the row's id.
              onChange({ ...newPredicate(next as SegmentField), id: node.id });
            }}
          />
        </Field>
        <Field className="min-w-[9rem]">
          <FieldLabel>Condition</FieldLabel>
          <Select
            color="module"
            aria-label="Condition"
            value={node.op}
            items={Object.fromEntries(
              operatorOptionsIncluding(node.field, node.op).map((o) => [o.value, o.label])
            )}
            onValueChange={(next) => {
              onChange({ ...node, op: next as SegmentOperator });
            }}
          />
        </Field>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          shape="square"
          aria-label="Remove this condition"
          title="Remove this condition"
          onClick={onRemove}
        >
          <Icon glyph={faXmark} className="size-4" aria-hidden />
        </Button>
      </div>

      {operatorTakesValue(node.op) ? (
        <Field>
          <FieldLabel>Value</FieldLabel>
          <FieldControl
            render={
              <ValueControl
                node={node}
                onChange={onChange}
                repItems={repItems}
                accountItems={accountItems}
              />
            }
          />
          {meta.hint ? <FieldDescription>{meta.hint}</FieldDescription> : null}
        </Field>
      ) : null}
    </div>
  );
}

/* ── A group of conditions ──────────────────────────────────────────────── */

export function RuleGroupEditor({
  node,
  onChange,
  onRemove,
  depth = 0,
  repItems,
  accountItems,
}: {
  node: GroupNode;
  onChange: (next: GroupNode) => void;
  /** Absent on the root — the root group cannot be removed. */
  onRemove?: () => void;
  depth?: number;
  repItems: Record<string, string>;
  accountItems: Record<string, string>;
}) {
  const changeChild = (index: number, next: EditorNode) => {
    onChange({ ...node, children: node.children.map((c, i) => (i === index ? next : c)) });
  };
  const removeChild = (index: number) => {
    onChange({ ...node, children: node.children.filter((_, i) => i !== index) });
  };

  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span" className="text-sm">
          Include customers that
        </Text>
        <div className="w-40">
          <Select
            size="sm"
            color="module"
            aria-label="Match or exclude"
            value={node.negate ? 'exclude' : 'match'}
            items={{ match: 'match', exclude: 'do not match' }}
            onValueChange={(next) => {
              onChange({ ...node, negate: next === 'exclude' });
            }}
          />
        </div>
        <div className="w-28">
          <Select
            size="sm"
            color="module"
            aria-label="All or any"
            value={node.combinator}
            items={{ and: 'all of', or: 'any of' }}
            onValueChange={(next) => {
              onChange({ ...node, combinator: next === 'or' ? 'or' : 'and' });
            }}
          />
        </div>
        <Text as="span" className="text-sm">
          these:
        </Text>
        <div className="flex-1" />
        {onRemove ? (
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            shape="square"
            aria-label="Remove this group"
            title="Remove this group"
            onClick={onRemove}
          >
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {node.children.length === 0 ? (
        <Text className="text-sm">
          This group has no conditions yet — add one below, or it will match everyone.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {node.children.map((child, index) =>
            child.kind === 'group' ? (
              <RuleGroupEditor
                key={child.id}
                node={child}
                depth={depth + 1}
                repItems={repItems}
                accountItems={accountItems}
                onChange={(next) => {
                  changeChild(index, next);
                }}
                onRemove={() => {
                  removeChild(index);
                }}
              />
            ) : (
              <PredicateEditor
                key={child.id}
                node={child}
                repItems={repItems}
                accountItems={accountItems}
                onChange={(next) => {
                  changeChild(index, next);
                }}
                onRemove={() => {
                  removeChild(index);
                }}
              />
            )
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            onChange({ ...node, children: [...node.children, newPredicate()] });
          }}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add a condition
        </Button>
        {depth < MAX_DEPTH ? (
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            onClick={() => {
              onChange({
                ...node,
                children: [...node.children, newGroup(node.combinator === 'and' ? 'or' : 'and')],
              });
            }}
          >
            <Icon glyph={faFolderPlus} className="size-4" aria-hidden />
            Add a group
          </Button>
        ) : null}
      </div>
    </div>
  );
}
