'use client';

// What a photo is tied to, once "when this photo shows" is not "always".
//
// Only one of the two blocks is ever on screen, because the mode above chose
// which question is being answered.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { variantLabel, type Binding } from './product-media-binding';
import type { ProductOption, Variant } from './products-data';

export function PhotoPinning({
  draft,
  variants,
  options,
  setDraft,
}: {
  draft: Binding;
  variants: Variant[];
  options: ProductOption[];
  setDraft: (update: (current: Binding) => Binding) => void;
}) {
  if (draft.mode === 'variant') {
    return (
      <Field>
        <FieldLabel>Which version</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="Which version this photo is of"
              placeholder="Choose a version"
              value={draft.variantId ?? ''}
              items={Object.fromEntries(
                variants.map((variant) => [variant.id, variantLabel(variant)])
              )}
              onValueChange={(next) => {
                setDraft((current) => ({ ...current, variantId: String(next) }));
              }}
            />
          }
        />
        <FieldDescription>
          This photo shows only when the shopper has settled on exactly this version.
        </FieldDescription>
      </Field>
    );
  }

  if (draft.mode !== 'choices') return null;

  const pinnedCount = Object.values(draft.byOption).filter((id) => id !== '').length;

  return (
    <div className="flex flex-col gap-4">
      {options.map((option) => (
        <Field key={option.id}>
          <FieldLabel>{option.name}</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                aria-label={option.name}
                placeholder={`Any ${option.name.toLowerCase()}`}
                value={draft.byOption[option.id] ?? ''}
                items={{
                  '': `Any ${option.name.toLowerCase()}`,
                  ...Object.fromEntries(option.values.map((value) => [value.id, value.value])),
                }}
                onValueChange={(next) => {
                  setDraft((current) => ({
                    ...current,
                    byOption: { ...current.byOption, [option.id]: String(next) },
                  }));
                }}
              />
            }
          />
        </Field>
      ))}
      <Text className="text-sm">
        {pinnedCount === 0
          ? 'Nothing is pinned yet, so this photo will keep showing for everyone. Pick a value above to tie it to one.'
          : 'The photo shows as soon as the shopper has picked everything named above. Leave anything on “any” to ignore it.'}
      </Text>
    </div>
  );
}
