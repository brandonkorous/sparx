'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE RULE EDITOR — a plain-language builder for a smart collection.
//
// A rules-based collection fills itself: instead of hand-picking products, you
// describe what belongs, and anything matching is pulled in (and drops out again
// when it stops matching). This editor is the PRODUCER of the format the rule
// compiler consumes — the canonical `CollectionRuleSet` = `{ match, predicates }`
// from `@wizeworks/commerce-schemas`. Every value it emits is a real field/op/value
// from that discriminated union, and collections-data's `buildRuleSet` runs the
// actual Zod schema before saving, so a shape the compiler would reject can
// never leave this screen.
//
// ── It must not read like a query builder ──────────────────────────────────
//
// The audience is a shop owner, not an engineer. So the fields are named for
// what they ARE to that person — "Brand", "Label", "Price", "Stock" — the
// operators are whole English phrases ("is at most", "has any of these labels"),
// and money is entered in pounds/dollars, not cents. The engineering vocabulary
// (vendor, product_type, predicate, between-tuple) stays entirely off-screen.
//
// ── Fitment is preserved, not authored here ────────────────────────────────
//
// The schema's seventh field, `fitment`, targets the vehicle/machine
// compatibility system by id — choosing one needs the Fitment surface's own
// pickers, not a text box. So this editor does NOT offer fitment as a new
// condition (an empty fitment rule would match nothing), but it faithfully KEEPS
// any fitment condition already on the collection and shows it as a locked row,
// so editing the other rules never silently drops it.
// ══════════════════════════════════════════════════════════════════════════

import {
  Autocomplete,
  Badge,
  Button,
  Input,
  Select,
  TagInput,
  Text,
} from '@wizeworks/silicaui-react';
import { Plus, Trash2 } from 'lucide-react';
import { MoneyInput } from '../invoicing/money-input';
import { useProductFacets } from './products-data';
import type { CollectionPredicate, CollectionRuleSet } from './collections-data';

/* ── The fields a person can add, in their words ────────────────────────── */

type AddableField = 'title' | 'vendor' | 'product_type' | 'tag' | 'price' | 'inventory';

const FIELD_LABELS: Record<AddableField, string> = {
  title: 'Product name',
  vendor: 'Brand',
  product_type: 'Kind of product',
  tag: 'Label',
  price: 'Price',
  inventory: 'Stock',
};

const FIELD_ORDER: AddableField[] = [
  'title',
  'vendor',
  'product_type',
  'tag',
  'price',
  'inventory',
];

/** Operator → the English phrase shown for it, per field. Exactly the ops the
 *  schema's discriminated union allows for each field — nothing invented. */
const OP_LABELS: Record<AddableField, Record<string, string>> = {
  title: {
    contains: 'contains',
    equals: 'is exactly',
    starts_with: 'starts with',
    ends_with: 'ends with',
  },
  vendor: { equals: 'is', in: 'is any of' },
  product_type: { equals: 'is', in: 'is any of' },
  tag: {
    equals: 'has the label',
    any_of: 'has any of these labels',
    all_of: 'has all of these labels',
    none_of: 'has none of these labels',
  },
  price: {
    lt: 'is less than',
    lte: 'is at most',
    gt: 'is more than',
    gte: 'is at least',
    between: 'is between',
  },
  inventory: {
    in_stock: 'is in stock',
    out_of_stock: 'is out of stock',
    low_stock: 'is running low',
  },
};

/** A fresh condition for a field, valid enough to render — its value may still be
 *  empty, which the save-time schema check catches with a friendly message. */
function defaultPredicate(field: AddableField): CollectionPredicate {
  switch (field) {
    case 'title':
      return { field: 'title', op: 'contains', value: '' };
    case 'vendor':
      return { field: 'vendor', op: 'equals', value: '' };
    case 'product_type':
      return { field: 'product_type', op: 'equals', value: '' };
    case 'tag':
      return { field: 'tag', op: 'any_of', value: [] };
    case 'price':
      return { field: 'price', op: 'gte', value: 0 };
    case 'inventory':
      return { field: 'inventory', op: 'in_stock', value: true };
  }
}

/** Whether a value should be a list (multi) or a single string, for the fields
 *  whose value type depends on the operator. */
function opWantsList(field: AddableField, op: string): boolean {
  if (field === 'vendor' || field === 'product_type') return op === 'in';
  if (field === 'tag') return op !== 'equals';
  return false;
}

function isFitment(predicate: CollectionPredicate): boolean {
  return predicate.field === 'fitment';
}

/* ── The editor ─────────────────────────────────────────────────────────── */

export function CollectionRulesEditor({
  value,
  onChange,
}: {
  value: CollectionRuleSet;
  onChange: (next: CollectionRuleSet) => void;
}) {
  const { data: facets } = useProductFacets();

  const setMatch = (match: 'all' | 'any') => {
    onChange({ ...value, match });
  };

  const setPredicate = (index: number, next: CollectionPredicate) => {
    onChange({ ...value, predicates: value.predicates.map((p, i) => (i === index ? next : p)) });
  };

  const removePredicate = (index: number) => {
    onChange({ ...value, predicates: value.predicates.filter((_, i) => i !== index) });
  };

  const addPredicate = (field: AddableField) => {
    onChange({ ...value, predicates: [...value.predicates, defaultPredicate(field)] });
  };

  const editable = value.predicates
    .map((predicate, index) => ({ predicate, index }))
    .filter((entry) => !isFitment(entry.predicate));
  const fitment = value.predicates
    .map((predicate, index) => ({ predicate, index }))
    .filter((entry) => isFitment(entry.predicate));

  return (
    <div className="flex flex-col gap-3">
      {/* The match mode reads as a sentence, so "ALL" vs "ANY" is a choice about
          how strict the collection is, not jargon. */}
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span">A product belongs here when it matches</Text>
        <div className="w-40">
          <Select
            size="sm"
            aria-label="How many conditions must match"
            value={value.match}
            items={[
              { value: 'all', label: 'all of' },
              { value: 'any', label: 'any of' },
            ]}
            onValueChange={(next) => {
              setMatch((next as 'all' | 'any') ?? 'all');
            }}
          />
        </div>
        <Text as="span">the conditions below.</Text>
      </div>

      {editable.length === 0 ? (
        <div className="border-base-300 rounded border border-dashed p-4">
          <Text>
            No conditions yet. Add one to describe which products belong here — for example, the
            price is at most a set amount, or the brand is one you choose.
          </Text>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {editable.map((entry) => (
            <li key={entry.index}>
              <PredicateRow
                predicate={entry.predicate}
                first={entry.index === editable[0]?.index}
                match={value.match}
                vendors={facets?.vendors ?? []}
                productTypes={facets?.productTypes ?? []}
                tags={facets?.tags ?? []}
                onChange={(next) => {
                  setPredicate(entry.index, next);
                }}
                onRemove={() => {
                  removePredicate(entry.index);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add-a-condition: one button per field, so a person browses "what can I
          match on" rather than opening a bare dropdown of database columns. */}
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span" className="text-sm">
          Add a condition:
        </Text>
        {FIELD_ORDER.map((field) => (
          <Button
            key={field}
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              addPredicate(field);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {FIELD_LABELS[field]}
          </Button>
        ))}
      </div>

      {/* Fitment lives elsewhere but must not be lost by editing here. */}
      {fitment.length > 0 ? (
        <div className="border-base-300 flex flex-col gap-2 rounded border p-3">
          <div className="flex items-center gap-2">
            <Text as="span" className="font-medium">
              {fitment.length === 1 ? 'A fitment condition' : 'Fitment conditions'}
            </Text>
            <Badge color="info" variant="soft" size="sm">
              Set up in Fitment
            </Badge>
          </div>
          <Text className="text-sm">
            {fitment.length === 1
              ? 'This collection also matches products that fit a particular machine or model. That condition is edited on the Fitment screen — it is kept exactly as it is when you save here.'
              : 'This collection also matches products that fit particular machines or models. Those conditions are edited on the Fitment screen — they are kept exactly as they are when you save here.'}
          </Text>
          <ul className="flex flex-col gap-1">
            {fitment.map((entry) => (
              <li key={entry.index} className="flex items-center justify-between gap-2">
                <Text as="span" className="text-sm">
                  Fits a chosen machine or model
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  onClick={() => {
                    removePredicate(entry.index);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ── One condition row ──────────────────────────────────────────────────── */

function PredicateRow({
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
        color="neutral"
        shape="square"
        aria-label="Remove this condition"
        className="shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
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

/* ── The value editor, per field + op ───────────────────────────────────── */

function ValueEditor({
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
    // The operator already says everything ("is in stock"); there is nothing to
    // type. Kept as a spacer so rows line up.
    return <Text className="text-sm @lg:pt-2">No value needed.</Text>;
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
