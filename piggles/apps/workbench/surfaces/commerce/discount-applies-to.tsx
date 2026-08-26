'use client';

// What the offer covers — the whole shop, or only certain groups of products.
//
// The rules to express this have existed in the data model since the module
// shipped (`collection_in`, `product_in`) and no screen ever offered them, so
// "15% off the core range" could not be written down and every code came off
// everything in the basket.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { useCollections } from './products-data';

interface AppliesToFieldProps {
  /** Collections the offer is limited to. EMPTY = the whole shop. */
  value: string[];
  onChange: (next: string[]) => void;
}

export function AppliesToField({ value, onChange }: AppliesToFieldProps) {
  const { data: collections, isPending } = useCollections();
  const everything = value.length === 0;
  const choices = collections ?? [];

  return (
    <FormSection
      title="What it applies to"
      description="The saving comes off these items only. Anything else in the basket stays full price."
    >
      <Field>
        <FieldLabel>Anything in the shop</FieldLabel>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={everything}
              onCheckedChange={(next: boolean) => {
                // Turning it off must land on a real group, or an empty list
                // would still quietly mean "everything".
                onChange(next ? [] : choices[0] ? [choices[0].id] : []);
              }}
            />
          }
        />
        <FieldDescription>
          {everything
            ? 'The saving comes off the whole basket.'
            : 'Turn this on to let the offer cover everything you sell.'}
        </FieldDescription>
      </Field>

      {everything ? null : isPending ? (
        <Text className="text-sm">Getting your groups…</Text>
      ) : choices.length === 0 ? (
        <Text className="text-sm">
          You have no groups of products yet. Make one under Sell, then come back and the offer can
          be kept to it.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {choices.map((collection) => (
            <label key={collection.id} className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={value.includes(collection.id)}
                aria-label={collection.name}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value, collection.id]
                    : value.filter((id) => id !== collection.id);
                  // Unticking the last one means "everything", which is the
                  // opposite of what the person is doing — refuse it.
                  onChange(next.length === 0 ? value : [...next].sort());
                }}
              />
              <Text as="span">{collection.name}</Text>
              <Text as="span" className="text-sm">
                {collection.productCount === 1 ? '1 item' : `${collection.productCount} items`}
              </Text>
            </label>
          ))}
        </div>
      )}
    </FormSection>
  );
}
