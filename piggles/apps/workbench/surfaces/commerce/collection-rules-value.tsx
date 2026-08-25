'use client';

// The value half of one condition: what to type or pick, per field and operator.
//
// Money is entered in dollars and stored in cents; a list operator gets a tag box;
// a yes/no operator has no value at all.

import { Autocomplete, Input, TagInput, Text } from '@wizeworks/silicaui-react';
import { MoneyInput } from '../../components/money-input';
import type { CollectionPredicate } from './collections-data';
import { opWantsList, type AddableField } from './collection-rules-fields';

/* ── The value editor, per field + op ───────────────────────────────────── */

export function ValueEditor({
  predicate,
  vendors,
  productTypes,
  tags,
  onChange,
}: {
  predicate: CollectionPredicate;
  vendors: string[];
  productTypes: string[];
  tags: string[];
  onChange: (next: CollectionPredicate) => void;
}) {
  const field = predicate.field as AddableField;

  if (field === 'inventory') {
    // "is in stock" says everything; "is running low" says nothing about WHERE the
    // line is, and there is no box to type it in — so the row has to (issue 204).
    return (
      <Text className="text-sm @lg:pt-2">
        {predicate.op === 'low_stock'
          ? 'A size counts as running low once it reaches the reorder point set for it under Stock. There is no fixed number here — change that point and this group follows.'
          : 'No value needed.'}
      </Text>
    );
  }

  if (field === 'title') {
    return (
      <Input
        size="sm"
        color="module"
        aria-label="Text to match"
        placeholder="Type the words to match"
        value={predicate.value as string}
        onChange={(event) => {
          onChange({ ...predicate, value: event.target.value } as CollectionPredicate);
        }}
      />
    );
  }

  if (field === 'price') {
    if (predicate.op === 'between') {
      const [min, max] = predicate.value as [number, number];
      return (
        <div className="flex items-center gap-2">
          <MoneyInput
            color="module"
            aria-label="Lowest price"
            value={min / 100}
            onValueChange={(dollars) => {
              onChange({ field: 'price', op: 'between', value: [Math.round(dollars * 100), max] });
            }}
          />
          <Text as="span" className="text-sm">
            and
          </Text>
          <MoneyInput
            color="module"
            aria-label="Highest price"
            value={max / 100}
            onValueChange={(dollars) => {
              onChange({ field: 'price', op: 'between', value: [min, Math.round(dollars * 100)] });
            }}
          />
        </div>
      );
    }
    return (
      <MoneyInput
        color="module"
        aria-label="Price"
        value={(predicate.value as number) / 100}
        onValueChange={(dollars) => {
          onChange({ ...predicate, value: Math.round(dollars * 100) } as CollectionPredicate);
        }}
      />
    );
  }

  // vendor / product_type / tag
  const suggestions = field === 'vendor' ? vendors : field === 'product_type' ? productTypes : tags;
  const wantsList = opWantsList(field, predicate.op);

  if (wantsList) {
    return (
      <TagInput
        size="sm"
        color="module"
        aria-label="Values to match"
        placeholder="Type a value and press Enter"
        value={predicate.value as string[]}
        onValueChange={(next) => {
          onChange({ ...predicate, value: next } as CollectionPredicate);
        }}
      />
    );
  }

  return (
    <Autocomplete
      size="sm"
      color="module"
      items={suggestions}
      value={predicate.value as string}
      placeholder="Type or choose a value"
      emptyMessage="No match — type your own."
      aria-label="Value to match"
      onValueChange={(next) => {
        onChange({ ...predicate, value: next } as CollectionPredicate);
      }}
    />
  );
}
