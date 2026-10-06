'use client';

// A markup rule on the catalog: which cost it starts from, which products
// Apply reprices, which rule wins when two cover one product, and what happens
// when a cost moves (sparx persona issue 086). Only shown for a rule that
// prices the catalog; a rule for quote lines needs none of it.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import type { MarkupScope } from '@wizeworks/commerce-schemas';
import { FormSection } from '../../components/form-section';
import { useCollections } from './products-data';
import type { DraftErrors, RuleDraft, SetRuleDraft } from './markup-rule-words';

type ScopeType = MarkupScope['type'];

function scopeItems(current: ScopeType) {
  return [
    { value: 'all', label: 'Everything you sell' },
    { value: 'collection', label: 'Only certain collections' },
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
  if (scope.type === 'collection' && scope.ids.length === 0) return 'Pick at least one collection.';
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
    return <Text className="text-sm">Your collections could not be loaded just now.</Text>;
  }
  if (collections.isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading your collections…
      </Text>
    );
  }
  if (collections.data.length === 0) {
    return <Text className="text-sm">You have no collections yet.</Text>;
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

function ScopeFields({
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
      {scope.type === 'collection' ? (
        <CollectionChoices
          ids={scope.ids}
          onChange={(ids) => {
            set('scope', { type: 'collection', ids });
          }}
        />
      ) : null}
      {scope.type === 'product_type' || scope.type === 'vendor' ? (
        <Input
          color={problem ? 'error' : 'module'}
          className="max-w-sm"
          aria-label={scope.type === 'vendor' ? 'Brand or maker' : 'Kind of product'}
          placeholder={scope.type === 'vendor' ? 'Bosch' : 'Fuel injectors'}
          value={scope.value}
          onChange={(event) => {
            set('scope', { type: scope.type, value: event.target.value });
          }}
        />
      ) : null}
      {scope.type === 'products' ? (
        <Text className="text-sm">
          {scope.ids.length === 1
            ? '1 product was chosen for this rule. It stays as it is unless you pick another option.'
            : `${String(scope.ids.length)} products were chosen for this rule. They stay as they are unless you pick another option.`}
        </Text>
      ) : null}
      {problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}
    </Field>
  );
}

function RecomputeFields({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>When a product&apos;s cost changes</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="When a product's cost changes"
              value={draft.recomputeMode}
              items={[
                { value: 'auto', label: 'Update its price' },
                { value: 'review', label: 'Ask me before changing its price' },
                { value: 'off', label: 'Leave its price alone' },
              ]}
              onValueChange={(next) => {
                if (next) set('recomputeMode', next as string);
              }}
            />
          }
        />
      </Field>
      {draft.recomputeMode === 'auto' ? (
        <Field>
          <FieldLabel>Ask me first if a price would move more than</FieldLabel>
          <FieldControl
            render={
              <div className="flex max-w-40 items-center gap-1">
                <Input
                  color={error ? 'error' : 'module'}
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label="Ask first if a price would move more than, in percent"
                  value={draft.tolerance}
                  onChange={(event) => {
                    set('tolerance', event.target.value);
                  }}
                />
                <Text as="span" className="text-sm">
                  %
                </Text>
              </div>
            }
          />
          {error ? (
            <FieldStatus status="error">{error}</FieldStatus>
          ) : (
            <FieldDescription>Leave it blank to always update.</FieldDescription>
          )}
        </Field>
      ) : null}
    </div>
  );
}

export function MarkupRuleCatalog({
  draft,
  set,
  errors,
  showErrors,
  apply,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  errors: DraftErrors;
  showErrors: boolean;
  /** The Apply block, for a saved rule; null while the rule is new. */
  apply: React.ReactNode;
}) {
  return (
    <FormSection
      title="Your catalog"
      description="How this rule prices the products it is applied to."
    >
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <Field>
          <FieldLabel>Start from</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                aria-label="Which cost the price starts from"
                value={draft.costBasis}
                items={[
                  { value: 'variant_cost', label: 'The cost on the product' },
                  { value: 'supplier_cost', label: "Your supplier's current cost" },
                ]}
                onValueChange={(next) => {
                  if (next) set('costBasis', next as string);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Rank</FieldLabel>
          <FieldControl
            render={
              <Input
                color={showErrors && errors.priority ? 'error' : 'module'}
                inputMode="numeric"
                className="max-w-24 text-right tabular-nums"
                aria-label="Rank"
                value={draft.priority}
                onChange={(event) => {
                  set('priority', event.target.value);
                }}
              />
            }
          />
          {showErrors && errors.priority ? (
            <FieldStatus status="error">{errors.priority}</FieldStatus>
          ) : (
            <FieldDescription>
              When two rules cover the same product, the higher number wins.
            </FieldDescription>
          )}
        </Field>
      </div>

      <ScopeFields draft={draft} set={set} showErrors={showErrors} />

      <RecomputeFields draft={draft} set={set} error={showErrors ? errors.tolerance : null} />

      {apply ?? (
        <Text className="text-sm">Save the rule first, then apply it to your products.</Text>
      )}
    </FormSection>
  );
}
