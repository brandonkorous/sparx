'use client';

// A category's description, its pictures, which sites show it, and how it reads
// in a search result.

import { Field, FieldControl, FieldLabel, Input, Textarea } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MediaField } from './media-field';
import { SiteScopeField } from '../../components/site-scope-field';
import type { Draft } from './category-draft';

export function CategoryExtras({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <>
      <FormSection
        title="Describe it"
        description="Optional. Shown at the top of the category's own page, and useful to search engines."
      >
        <Field>
          <FieldLabel>Description</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={4}
                value={draft.description}
                placeholder="Everything you need for a weekend under canvas."
                onChange={(event) => {
                  set('description', event.target.value);
                }}
              />
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="Pictures"
        description="Optional images your theme can use — a small icon in the menu, and a banner across the top of the category's page."
      >
        <MediaField
          label="Menu icon"
          description="A small square image shown next to the category name in some menus."
          value={draft.iconMediaId}
          onChange={(next) => {
            set('iconMediaId', next);
          }}
        />
        <MediaField
          label="Banner image"
          description="A wide picture shown across the top of this category's page."
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
        description="You run more than one website, so a category can appear on all of them or just some."
      />

      <FormSection
        title="How it looks in search results"
        description="Optional. When someone finds this category on Google, this is the title and summary they see. Left empty, the name and description above are used."
      >
        <Field>
          <FieldLabel>Search title</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.seoTitle}
                placeholder={draft.name || 'Camping gear'}
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
                placeholder="One or two sentences on what someone finds in this part of your site."
                onChange={(event) => {
                  set('seoDescription', event.target.value);
                }}
              />
            }
          />
        </Field>
        <MediaField
          label="Picture when shared"
          description="Shown when a link to this category is pasted into a message or a post."
          value={draft.ogImageId}
          onChange={(next) => {
            set('ogImageId', next);
          }}
        />
      </FormSection>
    </>
  );
}
