'use client';

// One condition, as a row: the field, the operator, its value, and the way out.
//
// A FITMENT condition is shown locked rather than hidden — this editor cannot
// author one, and dropping it silently while she edits the others would lose it.

import { Button, Select, Text } from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { CollectionPredicate } from './collections-data';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  OP_LABELS,
  defaultPredicate,
  opWantsList,
  type AddableField,
} from './collection-rules-fields';
import { ValueEditor } from './collection-rules-value';

/* ── One condition row ──────────────────────────────────────────────────── */

export function PredicateRow({
  predicate,
  first,
  match,
  vendors,
  productTypes,
  tags,
  onChange,
  onRemove,
}: {
  predicate: CollectionPredicate;
  first: boolean;
  match: 'all' | 'any';
  vendors: string[];
  productTypes: string[];
  tags: string[];
  onChange: (next: CollectionPredicate) => void;
  onRemove: () => void;
}) {
  // Fitment never reaches this row (filtered out above); the field here is always
  // one of the six addable ones.
  const field = predicate.field as AddableField;

  const changeField = (nextField: AddableField) => {
    if (nextField === field) return;
    onChange(defaultPredicate(nextField));
  };

  const changeOp = (nextOp: string) => {
    onChange(adjustForOp(predicate, nextOp));
  };

  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-2 rounded border p-3 @lg:flex-row @lg:items-start">
      {/* The joiner word ("and"/"or") reads the row as part of a sentence. */}
      <div className="flex shrink-0 items-center @lg:w-12 @lg:pt-2">
        <Text as="span" className="text-sm">
          {first ? 'Where' : match === 'all' ? 'and' : 'or'}
        </Text>
      </div>

      <div className="min-w-0 flex-1">
        <Select
          size="sm"
          aria-label="What to match on"
          value={field}
          items={FIELD_ORDER.map((option) => ({ value: option, label: FIELD_LABELS[option] }))}
          onValueChange={(next) => {
            changeField(next as AddableField);
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <Select
          size="sm"
          aria-label="Condition"
          value={predicate.op}
          items={Object.entries(OP_LABELS[field]).map(([op, label]) => ({ value: op, label }))}
          onValueChange={(next) => {
            changeOp(next as string);
          }}
        />
      </div>

      <div className="min-w-0 flex-[2]">
        <ValueEditor
          predicate={predicate}
          vendors={vendors}
          productTypes={productTypes}
          tags={tags}
          onChange={onChange}
        />
      </div>

      <Button
        size="sm"
        variant="ghost"
        shape="square"
        aria-label="Remove this condition"
        className="shrink-0"
        onClick={onRemove}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Change a predicate's operator, converting its value to the shape the new
 *  operator needs (single↔list for text fields, single↔range for price). */
function adjustForOp(predicate: CollectionPredicate, nextOp: string): CollectionPredicate {
  const field = predicate.field as AddableField;

  if (field === 'price') {
    const current = predicate.value as number | [number, number];
    if (nextOp === 'between') {
      const single = Array.isArray(current) ? current[0] : current;
      return { field: 'price', op: 'between', value: [single, single] };
    }
    const value = Array.isArray(current) ? current[0] : current;
    return { field: 'price', op: nextOp as 'lt' | 'lte' | 'gt' | 'gte', value };
  }

  if (field === 'inventory') {
    return {
      field: 'inventory',
      op: nextOp as 'in_stock' | 'out_of_stock' | 'low_stock',
      value: true,
    };
  }

  if (field === 'title') {
    return {
      field: 'title',
      op: nextOp as 'contains' | 'equals' | 'starts_with' | 'ends_with',
      value: predicate.value as string,
    };
  }

  // vendor / product_type / tag — value flips between string and string[].
  const wantsList = opWantsList(field, nextOp);
  const current = predicate.value as string | string[];
  const asList = Array.isArray(current) ? current : current ? [current] : [];
  const asSingle = Array.isArray(current) ? (current[0] ?? '') : current;

  if (field === 'tag') {
    return { field: 'tag', op: nextOp as never, value: wantsList ? asList : asSingle };
  }
  return { field, op: nextOp as never, value: wantsList ? asList : asSingle };
}
