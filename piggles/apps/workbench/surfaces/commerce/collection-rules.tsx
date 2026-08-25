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

import { Badge, Button, Select, Text } from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useProductFacets } from './products-data';
import type { CollectionPredicate, CollectionRuleSet } from './collections-data';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  defaultPredicate,
  isFitment,
  type AddableField,
} from './collection-rules-fields';
import { PredicateRow } from './collection-rules-row';
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
          how strict the group is, not jargon. */}
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
            <Icon glyph={faPlus} className="size-4" aria-hidden />
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
              ? 'This group also matches products that fit a particular machine or model. That condition is edited on the What fits what screen — it is kept exactly as it is when you save here.'
              : 'This group also matches products that fit particular machines or models. Those conditions are edited on the What fits what screen — they are kept exactly as they are when you save here.'}
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
                  color="danger"
                  onClick={() => {
                    removePredicate(entry.index);
                  }}
                >
                  <Icon glyph={faTrashCan} className="size-3.5" aria-hidden />
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
