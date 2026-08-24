'use client';

// What the product IS, and how it is filed — the two sections somebody came to
// this tab to change.

import {
  Autocomplete,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  TagInput,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { slugifyTyping } from '../../lib/slugify';
import { useProductFacets } from './products-data';
import type { Draft } from './product-overview-draft';

export function ProductFields({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const { data: facets } = useProductFacets();
  return (
    <>
      <FormSection title="What you are selling">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.title}
                onChange={(event) => {
                  set('title', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>What shoppers see.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Description</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={6}
                value={draft.description}
                placeholder="What it is, what it is made of, who it is for."
                onChange={(event) => {
                  set('description', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Shown on the product&apos;s page. Say what someone would ask you in person.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Web address</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.handle}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  // Keeps a hyphen she just pressed; tidied on save (issue #181).
                  set('handle', slugifyTyping(event.target.value, 127));
                }}
              />
            }
          />
          <FieldDescription>
            The end of this product&apos;s page address. Changing it breaks any link anyone has
            already saved or shared, so it is worth leaving alone once the product is on sale.
          </FieldDescription>
        </Field>
      </FormSection>

      <FormSection
        title="How you file it"
        description="None of this is required. It is what lets you find things later, and what shoppers use to browse."
      >
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <FieldControl
            render={
              <Autocomplete
                color="module"
                items={facets?.vendors ?? []}
                value={draft.vendor}
                placeholder="Who makes it"
                emptyMessage="No match — type your own."
                aria-label="Brand"
                onValueChange={(next) => {
                  set('vendor', next);
                }}
              />
            }
          />
          <FieldDescription>
            Who makes or supplies it. Type anything — the suggestions are just the ones you have
            used before.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Kind of thing</FieldLabel>
          <FieldControl
            render={
              <Autocomplete
                color="module"
                items={facets?.productTypes ?? []}
                value={draft.productType}
                placeholder="Footwear, Furniture, Service…"
                emptyMessage="No match — type your own."
                aria-label="Kind of thing"
                onValueChange={(next) => {
                  set('productType', next);
                }}
              />
            }
          />
          <FieldDescription>
            A broad category for this product. Type your own if none of the suggestions fit.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Labels</FieldLabel>
          <FieldControl
            render={
              <TagInput
                color="module"
                value={draft.tags}
                placeholder="Type a label and press Enter"
                aria-label="Labels"
                onValueChange={(next) => {
                  set('tags', next);
                }}
              />
            }
          />
          <FieldDescription>
            Your own words for grouping products — “summer”, “clearance”, “gift”. Only you see these
            unless you use them on your website.
          </FieldDescription>
        </Field>
      </FormSection>
    </>
  );
}
