'use client';

// Which products Apply reprices with a markup rule (sparx persona issue 086).
// A hand-picked list made elsewhere is shown and kept, never edited here.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import type { MarkupScope } from '@wizeworks/commerce-schemas';
import { useCollections } from './products-data';
import type { RuleDraft, SetRuleDraft } from './markup-rule-draft';

type ScopeType = MarkupScope['type'];

function scopeItems(current: ScopeType) {
  return [
    { value: 'all', label: 'Everything you sell' },
    { value: 'collection', label: 'Only certain groups of products' },
    { value: 'product_type', label: 'One kind of product' },
    { value: 'vendor', label: 'One brand or maker' },
    // A hand-picked list is made elsewhere and kept as it is; it is offered
    // only while the rule already has one.
    ...(current === 'products' ? [{ value: 'products', label: 'The products chosen for it' }] : []),
  ];
}

function scopeFor(type: ScopeType, previous: MarkupScope): MarkupScope {
  if (type === previous.type) return previous;
  switch (type) {
    case 'collection':
      return { type: 'collection', ids: [] };
    case 'product_type':
      return { type: 'product_type', value: '' };
    case 'vendor':
      return { type: 'vendor', value: '' };
    default:
      return { type: 'all' };
  }
}

/** Whether the scope names something to apply to. */
export function scopeProblem(scope: MarkupScope): string | null {
  if (scope.type === 'collection' && scope.ids.length === 0)
    return 'Pick at least one group of products.';
  if ((scope.type === 'product_type' || scope.type === 'vendor') && !scope.value.trim()) {
    return scope.type === 'vendor' ? 'Type the brand or maker.' : 'Type the kind of product.';
  }
  return null;
}

function CollectionChoices({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (next: string[]) => void;
}) {
  const collections = useCollections();
  if (collections.isError) {
    return <Text className="text-sm">Your groups of products could not be loaded just now.</Text>;
  }
  if (collections.isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading your groups of products…
      </Text>
    );
  }
  if (collections.data.length === 0) {
    return <Text className="text-sm">You have no groups of products yet.</Text>;
  }
  return (
    <ul className="grid grid-cols-1 gap-2 @md:grid-cols-2">
      {collections.data.map((collection) => (
        <li key={collection.id}>
          <label className="flex items-center gap-2">
            <Checkbox
              color="module"
              checked={ids.includes(collection.id)}
              aria-label={collection.name}
              onChange={(event) => {
                onChange(
                  event.target.checked
                    ? [...ids, collection.id]
                    : ids.filter((id) => id !== collection.id)
                );
              }}
            />
            <Text as="span">{collection.name}</Text>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** What the chosen scope needs beside the choice: collections, a word, or a note. */
function ScopeDetail({
  scope,
  set,
  problem,
}: {
  scope: MarkupScope;
  set: SetRuleDraft;
  problem: string | null;
}) {
  if (scope.type === 'collection') {
    return (
      <CollectionChoices
        ids={scope.ids}
        onChange={(ids) => {
          set('scope', { type: 'collection', ids });
        }}
      />
    );
  }
  if (scope.type === 'product_type' || scope.type === 'vendor') {
    const vendor = scope.type === 'vendor';
    return (
      <Input
        color={problem ? 'error' : 'module'}
        className="max-w-sm"
        aria-label={vendor ? 'Brand or maker' : 'Kind of product'}
        placeholder={vendor ? 'Bosch' : 'Fuel injectors'}
        value={scope.value}
        onChange={(event) => {
          set('scope', { type: scope.type, value: event.target.value });
        }}
      />
    );
  }
  if (scope.type !== 'products') return null;
  const n = scope.ids.length;
  return (
    <Text className="text-sm">
      {n === 1
        ? '1 product was chosen for this rule. It stays as it is unless you pick another option.'
        : `${String(n)} products were chosen for this rule. They stay as they are unless you pick another option.`}
    </Text>
  );
}

export function ScopeFields({
  draft,
  set,
  showErrors,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  showErrors: boolean;
}) {
  const scope = draft.scope;
  const problem = showErrors ? scopeProblem(scope) : null;
  return (
    <Field>
      <FieldLabel>Which products Apply reprices</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <Select
              color="module"
              aria-label="Which products Apply reprices"
              value={scope.type}
              items={scopeItems(scope.type)}
              onValueChange={(next) => {
                if (next) set('scope', scopeFor(next as ScopeType, scope));
              }}
            />
          </div>
        }
      />
      <ScopeDetail scope={scope} set={set} problem={problem} />
      {problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}
    </Field>
  );
}
