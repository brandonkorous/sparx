'use client';

// The parts of a collection that are not its products: a banner, which sites
// show it, and how it reads in a search result.

import { Field, FieldControl, FieldLabel, Input, Textarea } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MediaField } from './media-field';
import { SiteScopeField } from '../../components/site-scope-field';
import type { Draft } from './collection-draft';

export function CollectionExtras({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <>
      <FormSection
        title="Banner image"
        description="Optional. A picture your theme can show across the top of the collection's page."
      >
        <MediaField
          label="Banner image"
          description="A wide picture shown at the top of this collection's page."
          value={draft.heroMediaId}
          onChange={(next) => {
            set('heroMediaId', next);
          }}
        />
      </FormSection>

      <SiteScopeField
        value={draft.propertyIds}
        onChange={(next) => {
          set('propertyIds', next);
        }}
        title="Which of your sites show it"
        description="You run more than one website, so a collection can appear on all of them or just some."
      />

      <FormSection
        title="How it looks in search results"
        description="Optional. The title and summary shown when someone finds this collection on Google. Left empty, the name and description above are used."
      >
        <Field>
          <FieldLabel>Search title</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.seoTitle}
                placeholder={draft.name || 'Summer sale'}
                onChange={(event) => {
                  set('seoTitle', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Search summary</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={3}
                value={draft.seoDescription}
                placeholder="One or two sentences on what someone finds in this collection."
                onChange={(event) => {
                  set('seoDescription', event.target.value);
                }}
              />
            }
          />
        </Field>
        <MediaField
          label="Picture when shared"
          description="Shown when a link to this collection is pasted into a message or a post."
          value={draft.ogImageId}
          onChange={(next) => {
            set('ogImageId', next);
          }}
        />
      </FormSection>
    </>
  );
}
